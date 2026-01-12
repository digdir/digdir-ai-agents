/**
 * Web server for the review UI
 * Handles HTTP requests and WebSocket connections
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';

import { initGit, getCurrentVersion, getPreviousVersion, saveAndStage } from './lib/git.js';
import { computeLineDiff, calculateSimilarity, createAlignedLines, AlignedLine } from './lib/diff.js';
import { parseMarkdownSections, renderMarkdown, alignSections } from './lib/markdown.js';
import {
  ReviewSession,
  findExistingSession,
  createSession,
  saveSession,
  completeRound,
  addComment,
  getAllComments
} from './lib/state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ReviewRequest {
  nbFilePath: string;
  enFilePath?: string;
  mode: 'nb_only' | 'nb_and_en';
  sessionId?: string;
}

export interface ReviewResult {
  status: 'approved' | 'rejected' | 'edited' | 'cancelled';
  nbContent?: string;
  enContent?: string;
  feedback?: string;
  sessionId: string;
}

interface ReviewState {
  request: ReviewRequest;
  session: ReviewSession;
  resolve: (result: ReviewResult) => void;
  reject: (error: Error) => void;
}

let currentReview: ReviewState | null = null;
let wsClients: Set<WebSocket> = new Set();

/**
 * Start the web server and return when review is complete
 */
export async function startReviewServer(
  request: ReviewRequest,
  port: number = 3847
): Promise<ReviewResult> {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Serve static files
  app.use(express.static(path.join(__dirname, 'web')));
  app.use(express.json());

  // API endpoints
  app.get('/api/state', async (req, res) => {
    if (!currentReview) {
      return res.status(404).json({ error: 'No active review' });
    }

    try {
      const state = await buildReviewState(currentReview);
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/approve', async (req, res) => {
    if (!currentReview) {
      return res.status(404).json({ error: 'No active review' });
    }

    try {
      const { nbContent, enContent } = req.body;
      const gitModule = await initGit(currentReview.request.nbFilePath);

      // Save edited content if provided
      if (nbContent) {
        await saveAndStage(gitModule, currentReview.request.nbFilePath, nbContent);
      }
      if (enContent && currentReview.request.enFilePath) {
        await saveAndStage(gitModule, currentReview.request.enFilePath, enContent);
      }

      await completeRound(
        gitModule.repoRoot,
        currentReview.session,
        'approved',
        nbContent,
        enContent
      );

      currentReview.resolve({
        status: 'approved',
        nbContent,
        enContent,
        sessionId: currentReview.session.sessionId
      });

      res.json({ success: true });
      broadcastToClients({ type: 'closed', reason: 'approved' });

      // Shut down server after short delay
      setTimeout(() => server.close(), 500);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/reject', async (req, res) => {
    if (!currentReview) {
      return res.status(404).json({ error: 'No active review' });
    }

    try {
      const { feedback, nbContent, enContent } = req.body;
      const gitModule = await initGit(currentReview.request.nbFilePath);

      await completeRound(
        gitModule.repoRoot,
        currentReview.session,
        'rejected',
        nbContent,
        enContent,
        feedback
      );

      currentReview.resolve({
        status: 'rejected',
        feedback,
        nbContent,
        enContent,
        sessionId: currentReview.session.sessionId
      });

      res.json({ success: true });
      broadcastToClients({ type: 'closed', reason: 'rejected' });

      setTimeout(() => server.close(), 500);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/comment', async (req, res) => {
    if (!currentReview) {
      return res.status(404).json({ error: 'No active review' });
    }

    try {
      const { text, lineReference } = req.body;
      const gitModule = await initGit(currentReview.request.nbFilePath);

      await addComment(gitModule.repoRoot, currentReview.session, {
        author: 'human',
        text,
        lineReference
      });

      res.json({ success: true });
      broadcastToClients({ type: 'comment_added' });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // WebSocket handling
  wss.on('connection', (ws) => {
    wsClients.add(ws);

    ws.on('close', () => {
      wsClients.delete(ws);
    });

    // Send initial state
    if (currentReview) {
      buildReviewState(currentReview).then(state => {
        ws.send(JSON.stringify({ type: 'state', data: state }));
      });
    }
  });

  // Create promise that resolves when review is complete
  return new Promise((resolve, reject) => {
    initializeReview(request, resolve, reject).then(() => {
      server.listen(port, () => {
        console.log(`Review server running at http://localhost:${port}`);
      });

      // Handle server shutdown
      server.on('close', () => {
        if (currentReview) {
          currentReview.resolve({
            status: 'cancelled',
            sessionId: currentReview.session.sessionId
          });
        }
        currentReview = null;
        wsClients.clear();
      });
    }).catch(reject);
  });
}

async function initializeReview(
  request: ReviewRequest,
  resolve: (result: ReviewResult) => void,
  reject: (error: Error) => void
): Promise<void> {
  const gitModule = await initGit(request.nbFilePath);
  const nbContent = await getCurrentVersion(request.nbFilePath);
  const enContent = request.enFilePath
    ? await getCurrentVersion(request.enFilePath)
    : undefined;

  // Get base commit hash
  const log = await gitModule.git.log({ maxCount: 1 });
  const baseCommit = log.latest?.hash || 'HEAD';

  // Find or create session
  let session = await findExistingSession(
    gitModule.repoRoot,
    request.nbFilePath,
    request.enFilePath
  );

  if (!session) {
    session = await createSession(
      gitModule.repoRoot,
      request.nbFilePath,
      nbContent,
      baseCommit,
      request.enFilePath,
      enContent
    );
  }

  currentReview = {
    request,
    session,
    resolve,
    reject
  };
}

async function buildReviewState(review: ReviewState) {
  const { request, session } = review;
  const gitModule = await initGit(request.nbFilePath);

  // Get current and previous versions
  const nbCurrent = await getCurrentVersion(request.nbFilePath);
  const nbPrevious = await getPreviousVersion(gitModule, request.nbFilePath);

  let enCurrent: string | undefined;
  let enPrevious: Awaited<ReturnType<typeof getPreviousVersion>> | undefined;

  if (request.enFilePath) {
    enCurrent = await getCurrentVersion(request.enFilePath);
    enPrevious = await getPreviousVersion(gitModule, request.enFilePath);
  }

  // Compute diffs and aligned lines
  const nbDiff = nbPrevious
    ? computeLineDiff(nbPrevious.content, nbCurrent)
    : [];

  const nbAlignedLines = nbPrevious
    ? createAlignedLines(nbPrevious.content, nbCurrent)
    : null;

  const enDiff = enPrevious && enCurrent
    ? computeLineDiff(enPrevious.content, enCurrent)
    : [];

  const enAlignedLines = enPrevious && enCurrent
    ? createAlignedLines(enPrevious.content, enCurrent)
    : null;

  // Parse sections for alignment
  const nbSections = parseMarkdownSections(nbCurrent);
  const enSections = enCurrent ? parseMarkdownSections(enCurrent) : null;

  const alignedSections = enSections
    ? alignSections(nbSections.sections, enSections.sections)
    : null;

  // Calculate similarity scores
  const nbSimilarity = nbPrevious
    ? calculateSimilarity(nbPrevious.content, nbCurrent)
    : 100;

  const enSimilarity = enPrevious && enCurrent
    ? calculateSimilarity(enPrevious.content, enCurrent)
    : 100;

  return {
    mode: request.mode,
    sessionId: session.sessionId,
    currentRound: session.currentRound,
    comments: getAllComments(session),
    nb: {
      filePath: request.nbFilePath,
      current: nbCurrent,
      previous: nbPrevious?.content || null,
      diff: nbDiff,
      alignedLines: nbAlignedLines,
      similarity: nbSimilarity,
      sections: nbSections.sections,
      frontMatter: nbSections.frontMatter
    },
    en: request.enFilePath ? {
      filePath: request.enFilePath,
      current: enCurrent,
      previous: enPrevious?.content || null,
      diff: enDiff,
      alignedLines: enAlignedLines,
      similarity: enSimilarity,
      sections: enSections?.sections || [],
      frontMatter: enSections?.frontMatter || null
    } : null,
    alignedSections
  };
}

function broadcastToClients(message: object): void {
  const data = JSON.stringify(message);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Allow running directly for testing
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const testRequest: ReviewRequest = {
    nbFilePath: process.argv[2] || './test.nb.md',
    enFilePath: process.argv[3],
    mode: process.argv[3] ? 'nb_and_en' : 'nb_only'
  };

  startReviewServer(testRequest).then(result => {
    console.log('Review complete:', result);
    process.exit(0);
  }).catch(error => {
    console.error('Review failed:', error);
    process.exit(1);
  });
}

/**
 * Session state management for review workflow
 * Persists state between review rounds to maintain context
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ReviewComment {
  timestamp: string;
  author: 'human' | 'ai';
  text: string;
  lineReference?: number;
  resolved: boolean;
}

export interface ReviewRound {
  roundNumber: number;
  startedAt: string;
  completedAt?: string;
  status: 'pending' | 'approved' | 'rejected' | 'edited';
  comments: ReviewComment[];
  nbContentBefore: string;
  nbContentAfter?: string;
  enContentBefore?: string;
  enContentAfter?: string;
}

export interface ReviewSession {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  nbFilePath: string;
  enFilePath?: string;
  baseCommit: string;
  currentRound: number;
  rounds: ReviewRound[];
  finalStatus?: 'approved' | 'cancelled';
}

const STATE_DIR = '.doc-review-state';

/**
 * Generate a unique session ID based on file paths
 */
function generateSessionId(nbFilePath: string, enFilePath?: string): string {
  const input = `${nbFilePath}|${enFilePath || ''}|${Date.now()}`;
  return crypto.createHash('md5').update(input).digest('hex').slice(0, 12);
}

/**
 * Get state file path for a session
 */
function getStateFilePath(repoRoot: string, sessionId: string): string {
  return path.join(repoRoot, STATE_DIR, `${sessionId}.json`);
}

/**
 * Find existing session for given files
 */
export async function findExistingSession(
  repoRoot: string,
  nbFilePath: string,
  enFilePath?: string
): Promise<ReviewSession | null> {
  const stateDir = path.join(repoRoot, STATE_DIR);

  try {
    await fs.access(stateDir);
  } catch {
    return null;
  }

  const files = await fs.readdir(stateDir);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    try {
      const content = await fs.readFile(path.join(stateDir, file), 'utf-8');
      const session: ReviewSession = JSON.parse(content);

      // Match by file paths and check if not finalized
      if (
        session.nbFilePath === nbFilePath &&
        session.enFilePath === enFilePath &&
        !session.finalStatus
      ) {
        return session;
      }
    } catch {
      // Skip invalid files
    }
  }

  return null;
}

/**
 * Create a new review session
 */
export async function createSession(
  repoRoot: string,
  nbFilePath: string,
  nbContent: string,
  baseCommit: string,
  enFilePath?: string,
  enContent?: string
): Promise<ReviewSession> {
  const sessionId = generateSessionId(nbFilePath, enFilePath);
  const now = new Date().toISOString();

  const session: ReviewSession = {
    sessionId,
    createdAt: now,
    updatedAt: now,
    nbFilePath,
    enFilePath,
    baseCommit,
    currentRound: 1,
    rounds: [
      {
        roundNumber: 1,
        startedAt: now,
        status: 'pending',
        comments: [],
        nbContentBefore: nbContent,
        enContentBefore: enContent
      }
    ]
  };

  await saveSession(repoRoot, session);
  return session;
}

/**
 * Save session state to disk
 */
export async function saveSession(
  repoRoot: string,
  session: ReviewSession
): Promise<void> {
  const stateDir = path.join(repoRoot, STATE_DIR);

  // Ensure state directory exists
  await fs.mkdir(stateDir, { recursive: true });

  // Add to .gitignore if not present
  const gitignorePath = path.join(stateDir, '.gitignore');
  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(gitignorePath, '*\n!.gitignore\n');
  }

  session.updatedAt = new Date().toISOString();
  const filePath = getStateFilePath(repoRoot, session.sessionId);
  await fs.writeFile(filePath, JSON.stringify(session, null, 2));
}

/**
 * Load session by ID
 */
export async function loadSession(
  repoRoot: string,
  sessionId: string
): Promise<ReviewSession | null> {
  const filePath = getStateFilePath(repoRoot, sessionId);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Add a comment to the current review round
 */
export async function addComment(
  repoRoot: string,
  session: ReviewSession,
  comment: Omit<ReviewComment, 'timestamp' | 'resolved'>
): Promise<ReviewSession> {
  const currentRound = session.rounds[session.currentRound - 1];

  currentRound.comments.push({
    ...comment,
    timestamp: new Date().toISOString(),
    resolved: false
  });

  await saveSession(repoRoot, session);
  return session;
}

/**
 * Complete current round with a status
 */
export async function completeRound(
  repoRoot: string,
  session: ReviewSession,
  status: 'approved' | 'rejected' | 'edited',
  nbContentAfter?: string,
  enContentAfter?: string,
  feedback?: string
): Promise<ReviewSession> {
  const currentRound = session.rounds[session.currentRound - 1];
  currentRound.completedAt = new Date().toISOString();
  currentRound.status = status;
  currentRound.nbContentAfter = nbContentAfter;
  currentRound.enContentAfter = enContentAfter;

  if (feedback) {
    currentRound.comments.push({
      timestamp: new Date().toISOString(),
      author: 'human',
      text: feedback,
      resolved: false
    });
  }

  if (status === 'approved') {
    session.finalStatus = 'approved';
  } else if (status === 'rejected' || status === 'edited') {
    // Start new round
    session.currentRound++;
    session.rounds.push({
      roundNumber: session.currentRound,
      startedAt: new Date().toISOString(),
      status: 'pending',
      comments: [],
      nbContentBefore: nbContentAfter || currentRound.nbContentBefore,
      enContentBefore: enContentAfter || currentRound.enContentBefore
    });
  }

  await saveSession(repoRoot, session);
  return session;
}

/**
 * Get all comments from all rounds (for context)
 */
export function getAllComments(session: ReviewSession): ReviewComment[] {
  return session.rounds.flatMap(round => round.comments);
}

/**
 * Get feedback summary for AI
 */
export function getFeedbackSummary(session: ReviewSession): string {
  const comments = getAllComments(session);
  if (comments.length === 0) return '';

  const humanComments = comments.filter(c => c.author === 'human' && !c.resolved);
  if (humanComments.length === 0) return '';

  return humanComments
    .map((c, i) => `${i + 1}. ${c.text}`)
    .join('\n');
}

/**
 * Cancel and clean up a session
 */
export async function cancelSession(
  repoRoot: string,
  session: ReviewSession
): Promise<void> {
  session.finalStatus = 'cancelled';
  await saveSession(repoRoot, session);
}

/**
 * Delete session file
 */
export async function deleteSession(
  repoRoot: string,
  sessionId: string
): Promise<void> {
  const filePath = getStateFilePath(repoRoot, sessionId);

  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore if doesn't exist
  }
}

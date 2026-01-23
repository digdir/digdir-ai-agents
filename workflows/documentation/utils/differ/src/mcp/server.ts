#!/usr/bin/env node
/**
 * MCP Server for documentation review
 * Exposes review_documentation tool for Claude Code integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import open from 'open';
import * as path from 'path';

import { startReviewServer, ReviewRequest, ReviewResult } from '../server.js';
import { loadSession, getFeedbackSummary } from '../lib/state.js';
import { initGit } from '../lib/git.js';

const server = new Server(
  {
    name: 'doc-review',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'review_documentation',
    description: `Opens a visual review interface for human-in-the-loop documentation approval.

Use this tool after writing or updating documentation to get human review and approval.
The tool will:
1. Open a browser window with a side-by-side diff view
2. Allow the reviewer to see changes, edit content, and add comments
3. Wait for the reviewer to approve or reject the changes
4. Return the result with any feedback or edits

The reviewer can:
- See old vs new content with diff highlighting
- Compare Norwegian and English versions side-by-side
- Edit content directly in the browser
- Add comments for the AI to address
- Approve or reject with feedback

Session state is preserved between review rounds, so feedback history is maintained.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        nb_file: {
          type: 'string',
          description: 'Path to the Norwegian markdown file (required)'
        },
        en_file: {
          type: 'string',
          description: 'Path to the English markdown file (optional, for translation review)'
        },
        session_id: {
          type: 'string',
          description: 'Session ID to resume a previous review (optional)'
        }
      },
      required: ['nb_file']
    }
  },
  {
    name: 'get_review_feedback',
    description: `Get accumulated feedback from a review session.

Use this to retrieve all comments and feedback from previous review rounds.
This is useful when the reviewer rejected changes and you need to understand what to fix.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'Session ID from a previous review'
        },
        nb_file: {
          type: 'string',
          description: 'Path to the Norwegian file (used to find session if session_id not provided)'
        }
      },
      required: []
    }
  }
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'review_documentation') {
    return await handleReviewDocumentation(args as {
      nb_file: string;
      en_file?: string;
      session_id?: string;
    });
  }

  if (name === 'get_review_feedback') {
    return await handleGetFeedback(args as {
      session_id?: string;
      nb_file?: string;
    });
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: `Unknown tool: ${name}`
      }
    ],
    isError: true
  };
});

async function handleReviewDocumentation(args: {
  nb_file: string;
  en_file?: string;
  session_id?: string;
}) {
  const { nb_file, en_file, session_id } = args;

  // Resolve paths
  const nbFilePath = path.resolve(nb_file);
  const enFilePath = en_file ? path.resolve(en_file) : undefined;

  const request: ReviewRequest = {
    nbFilePath,
    enFilePath,
    mode: enFilePath ? 'nb_and_en' : 'nb_only',
    sessionId: session_id
  };

  // Find available port
  const port = 3847 + Math.floor(Math.random() * 100);

  try {
    // Start server in background and open browser
    const resultPromise = startReviewServer(request, port);

    // Give server a moment to start
    await new Promise(resolve => setTimeout(resolve, 500));

    // Open browser
    await open(`http://localhost:${port}`);

    // Wait for review to complete
    const result: ReviewResult = await resultPromise;

    // Format response based on result
    if (result.status === 'approved') {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Review APPROVED

Session ID: ${result.sessionId}

${result.nbContent ? 'Norwegian content was edited during review.' : 'Norwegian content approved as-is.'}
${result.enContent ? 'English content was edited during review.' : enFilePath ? 'English content approved as-is.' : ''}

The changes have been staged in git. You can proceed with the next step.`
          }
        ]
      };
    }

    if (result.status === 'rejected') {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Review REJECTED

Session ID: ${result.sessionId}

Feedback from reviewer:
${result.feedback || 'No specific feedback provided.'}

${result.nbContent ? 'Reviewer made edits to Norwegian content - use the updated content.' : ''}
${result.enContent ? 'Reviewer made edits to English content - use the updated content.' : ''}

Please address the feedback and request a new review using the same session_id to maintain context.`
          }
        ]
      };
    }

    if (result.status === 'edited') {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Review completed with EDITS

Session ID: ${result.sessionId}

The reviewer made edits to the content. Updated content has been saved.
Please review the changes and request another review round if needed.`
          }
        ]
      };
    }

    // Cancelled
    return {
      content: [
        {
          type: 'text' as const,
          text: `Review CANCELLED

Session ID: ${result.sessionId}

The review was cancelled by the user. You may start a new review when ready.`
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Review failed: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}

async function handleGetFeedback(args: {
  session_id?: string;
  nb_file?: string;
}) {
  const { session_id, nb_file } = args;

  if (!session_id && !nb_file) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Either session_id or nb_file must be provided'
        }
      ],
      isError: true
    };
  }

  try {
    let repoRoot: string;

    if (nb_file) {
      const gitModule = await initGit(nb_file);
      repoRoot = gitModule.repoRoot;
    } else {
      // Use current directory
      const gitModule = await initGit('.');
      repoRoot = gitModule.repoRoot;
    }

    if (session_id) {
      const session = await loadSession(repoRoot, session_id);

      if (!session) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Session not found: ${session_id}`
            }
          ],
          isError: true
        };
      }

      const feedback = getFeedbackSummary(session);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Feedback from session ${session_id}:

Current round: ${session.currentRound}
Total comments: ${session.rounds.flatMap(r => r.comments).length}

${feedback || 'No unresolved feedback.'}

Session files:
- Norwegian: ${session.nbFilePath}
${session.enFilePath ? `- English: ${session.enFilePath}` : ''}`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: 'No session found for the specified file.'
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Failed to get feedback: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
}

// Build info for debugging
const BUILD_VERSION = '0.1.0';
const BUILD_TIMESTAMP = new Date().toISOString();

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Doc Review MCP server v${BUILD_VERSION} started at ${BUILD_TIMESTAMP}`);
  console.error('Diff normalization: CRLF/LF handling enabled');
}

main().catch(console.error);

/**
 * Shared types for the handoff to the proxy-agent queue. integrations is the
 * "receiver" that proxy-agent's README describes: it translates Slack/GitHub
 * events into one JSON line in `triggers/inbox.jsonl`, and posts proxy-agent's
 * results (`triggers/results.jsonl` + `triggers/logs/<id>.log`) back to the
 * originating thread/issue.
 */

/** One line appended to `triggers/inbox.jsonl`. Matches proxy-agent's event format. */
export interface QueueEvent {
  id: string;
  source: "slack" | "github";
  type: string;
  received_at: string;
  prompt: string;
  payload: Record<string, unknown>;
}

/**
 * Where a result for a given event id should be posted back to. Also carries
 * the "working" reaction to clear once the answer is posted (if any). These
 * fields are persisted in the pending map, so cleanup survives a restart.
 */
export type ReplyContext =
  | {
      kind: "slack";
      channel: string;
      threadTs: string;
      /** ts of the message the working reaction sits on. */
      messageTs?: string;
      /** Working reaction to remove once answered. */
      workingReaction?: string;
    }
  | {
      kind: "github";
      owner: string;
      repo: string;
      issueNumber: number;
      /** Reactions endpoint + id of the working reaction to remove once answered. */
      reactionsUrl?: string;
      reactionId?: number;
    };

/**
 * One line read from `triggers/results.jsonl`, written by proxy-agent. `intent`
 * and `reply` are produced by the agent's classification step; older results
 * without them fall back to posting the raw log.
 */
export interface ResultLine {
  id: string;
  status: string;
  exit_code?: number;
  log?: string;
  /** How the agent classified the input. */
  intent?: "action" | "feedback" | "ack" | string;
  /** Clean answer text to post back (as opposed to the raw log). */
  reply?: string;
  started_at?: string;
  finished_at?: string;
}

/**
 * How a result should be delivered to its origin:
 *   - "message": post the text (a threaded reply / issue comment).
 *   - "ack": post nothing, just add an acknowledgement reaction to the origin.
 */
export type Delivery =
  | { kind: "message"; text: string }
  | { kind: "ack" };

/**
 * Posters the result watcher calls to deliver a result. A connector that is
 * disabled simply has no poster registered, and the watcher logs and skips.
 */
export interface ResultPosters {
  slack?: (reply: Extract<ReplyContext, { kind: "slack" }>, delivery: Delivery) => Promise<void>;
  github?: (reply: Extract<ReplyContext, { kind: "github" }>, delivery: Delivery) => Promise<void>;
}

import "dotenv/config";
import path from "node:path";

export interface GithubConfig {
  enabled: boolean;
  /** Token for issue/PR/reaction actions (fine-grained PAT works). */
  token: string;
  /** Token for the notifications API — a classic PAT with `notifications` scope. */
  notificationsToken: string;
  /** Acknowledgement reaction used when no answer will be posted back. */
  reaction: string;
  /** "Working…" reaction shown while the agent runs, removed once answered. */
  workingReaction: string;
  /** Reaction added when the agent classifies the input as "ack". */
  ackReaction: string;
  pollIntervalSeconds: number;
  apiBaseUrl: string;
}

export interface SlackConfig {
  enabled: boolean;
  appToken: string;
  botToken: string;
  /** Acknowledgement reaction used when no answer will be posted back. */
  reaction: string;
  /** "Working…" reaction shown while the agent runs, removed once answered. */
  workingReaction: string;
  /** Reaction added when the agent classifies the input as "ack". */
  ackReaction: string;
}

export interface AgentQueueConfig {
  enabled: boolean;
  /** dd-agent's shared `triggers/` directory. */
  triggersDir: string;
  inboxFile: string;
  resultsFile: string;
  /** agent-bot's own state (pending replies + results offset). */
  stateDir: string;
  resultsPollIntervalSeconds: number;
  /** Whether to poll results and post answers back to Slack/GitHub. */
  postResults: boolean;
  /** Upper bound on a posted reply's length; longer output is truncated. */
  maxReplyChars: number;
}

export interface Config {
  github: GithubConfig;
  slack: SlackConfig;
  agentQueue: AgentQueueConfig;
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function loadConfig(): Config {
  const github: GithubConfig = {
    enabled: bool(process.env.GITHUB_ENABLED),
    token: "",
    notificationsToken: "",
    reaction: (process.env.GITHUB_REACTION ?? "rocket").trim(),
    workingReaction: (process.env.GITHUB_WORKING_REACTION ?? "eyes").trim(),
    ackReaction: (process.env.GITHUB_ACK_REACTION ?? "+1").trim(),
    pollIntervalSeconds: Number(process.env.GITHUB_POLL_INTERVAL ?? "60"),
    apiBaseUrl: (process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/+$/, ""),
  };

  const slack: SlackConfig = {
    enabled: bool(process.env.SLACK_ENABLED),
    appToken: "",
    botToken: "",
    reaction: (process.env.SLACK_REACTION ?? "shrug").trim(),
    workingReaction: (process.env.SLACK_WORKING_REACTION ?? "thinking_face").trim(),
    ackReaction: (process.env.SLACK_ACK_REACTION ?? "white_check_mark").trim(),
  };

  if (github.enabled) {
    const actionRaw = (process.env.GITHUB_TOKEN ?? "").trim();
    const notifRaw = (process.env.GITHUB_TOKEN_CLASSIC_NOTIFICATIONS ?? "").trim();
    if (!actionRaw && !notifRaw) {
      throw new Error(
        "Set GITHUB_TOKEN and/or GITHUB_TOKEN_CLASSIC_NOTIFICATIONS. A single " +
          "classic PAT with `repo` + `notifications` scopes works for both roles.",
      );
    }
    // Each role falls back to the other token when only one is provided, so a
    // single all-purpose token works regardless of which variable you set.
    github.token = actionRaw || notifRaw;
    github.notificationsToken = notifRaw || actionRaw;
    if (!Number.isFinite(github.pollIntervalSeconds) || github.pollIntervalSeconds < 1) {
      throw new Error("GITHUB_POLL_INTERVAL must be a positive number of seconds");
    }
  }

  if (slack.enabled) {
    slack.appToken = requireEnv("SLACK_APP_TOKEN");
    slack.botToken = requireEnv("SLACK_BOT_TOKEN");
  }

  const agentQueue: AgentQueueConfig = {
    enabled: bool(process.env.AGENT_QUEUE_ENABLED),
    triggersDir: "",
    inboxFile: "",
    resultsFile: "",
    stateDir: path.resolve((process.env.AGENT_STATE_DIR ?? ".state").trim()),
    resultsPollIntervalSeconds: Number(process.env.AGENT_RESULTS_POLL_INTERVAL ?? "5"),
    postResults: bool(process.env.AGENT_POST_RESULTS, true),
    maxReplyChars: Number(process.env.AGENT_MAX_REPLY_CHARS ?? "12000"),
  };

  if (agentQueue.enabled) {
    const dir = (process.env.AGENT_TRIGGERS_DIR ?? "").trim();
    if (!dir) {
      throw new Error(
        "AGENT_QUEUE_ENABLED is true but AGENT_TRIGGERS_DIR is not set — point it " +
          "at an agent's `triggers/` directory (e.g. ../agents/dd-agent/triggers).",
      );
    }
    agentQueue.triggersDir = path.resolve(dir);
    agentQueue.inboxFile = path.join(agentQueue.triggersDir, "inbox.jsonl");
    agentQueue.resultsFile = path.join(agentQueue.triggersDir, "results.jsonl");
    if (!Number.isFinite(agentQueue.resultsPollIntervalSeconds) || agentQueue.resultsPollIntervalSeconds < 1) {
      throw new Error("AGENT_RESULTS_POLL_INTERVAL must be a positive number of seconds");
    }
    if (!Number.isFinite(agentQueue.maxReplyChars) || agentQueue.maxReplyChars < 1) {
      throw new Error("AGENT_MAX_REPLY_CHARS must be a positive number");
    }
  }

  return { github, slack, agentQueue };
}

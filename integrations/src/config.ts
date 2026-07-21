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

/** A queue-connected agent: a `triggers/` directory following the contract. */
export interface AgentRoute {
  name: string;
  triggersDir: string;
  inboxFile: string;
  resultsFile: string;
}

export interface AgentQueueConfig {
  enabled: boolean;
  /** proxy-agent's shared `triggers/` directory. */
  triggersDir: string;
  inboxFile: string;
  resultsFile: string;
  /** Name of the primary agent (receives external events). */
  primaryName: string;
  /**
   * Delegation targets: agents another agent's result may hand a task off to
   * (`intent: "delegate"`). Resolved from AGENT_ROUTES by the convention
   * `<agentsDir>/<name>/triggers`. Empty = delegation disabled.
   */
  routes: AgentRoute[];
  /** Max delegation hops for one originating event (loop guard). */
  maxDelegationHops: number;
  /**
   * When true, the delegating agent receives a `delegation-outcome` event in
   * its inbox once the delegated answer has been delivered. The debrief has no
   * pending reply route and does not count as a delegation hop.
   */
  delegationDebrief: boolean;
  /** integrations's own state (pending replies + results offset). */
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
    primaryName: (process.env.AGENT_PRIMARY_NAME ?? "proxy-agent").trim(),
    routes: [],
    maxDelegationHops: Number(process.env.AGENT_MAX_DELEGATION_HOPS ?? "2"),
    delegationDebrief: bool(process.env.AGENT_DELEGATION_DEBRIEF, true),
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
          "at an agent's `triggers/` directory (e.g. ../agents/proxy-agent/triggers).",
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
    if (!Number.isFinite(agentQueue.maxDelegationHops) || agentQueue.maxDelegationHops < 1) {
      throw new Error("AGENT_MAX_DELEGATION_HOPS must be a positive number");
    }

    // Delegation routes: comma-separated agent names, each resolved by the
    // monorepo convention <AGENT_AGENTS_DIR>/<name>/triggers.
    const agentsDir = path.resolve((process.env.AGENT_AGENTS_DIR ?? "../agents").trim());
    const routeNames = (process.env.AGENT_ROUTES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    for (const name of routeNames) {
      if (!/^[a-zA-Z0-9._-]+$/.test(name) || name === "." || name === "..") {
        throw new Error(`AGENT_ROUTES: invalid agent name "${name}" (allowed: letters, digits, . _ -)`);
      }
      if (name === agentQueue.primaryName || agentQueue.routes.some((r) => r.name === name)) continue;
      const triggersDir = path.join(agentsDir, name, "triggers");
      agentQueue.routes.push({
        name,
        triggersDir,
        inboxFile: path.join(triggersDir, "inbox.jsonl"),
        resultsFile: path.join(triggersDir, "results.jsonl"),
      });
    }
  }

  return { github, slack, agentQueue };
}

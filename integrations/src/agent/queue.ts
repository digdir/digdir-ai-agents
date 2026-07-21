import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentQueueConfig, AgentRoute } from "../config.ts";
import { createLogger } from "../logger.ts";
import type { Delivery, QueueEvent, ReplyContext, ResultLine, ResultPosters } from "./types.ts";

const log = createLogger("queue");

/**
 * Bridges integrations to the agents over their shared `triggers/` directories:
 *   - {@link submit} appends an event to the primary agent's `inbox.jsonl` and
 *     remembers where its eventual result should be posted (the pending map,
 *     persisted to disk so it survives restarts between submit and result).
 *   - {@link startResultWatcher} tails every agent's `results.jsonl`, reads the
 *     matching log, and hands the answer to the registered posters.
 *   - A result with `intent: "delegate"` is routed onwards: the task becomes a
 *     new event in the target agent's inbox, and the pending reply is remapped
 *     so the final answer still lands in the originating thread/issue.
 */
export class AgentQueue {
  private readonly config: AgentQueueConfig;
  /** All queue-connected agents: primary first, then delegation routes. */
  private readonly agents: AgentRoute[];
  /** id -> where to post the result. The source of truth; disk mirrors it. */
  private pending = new Map<string, ReplyContext>();
  /** Per-agent read offset into its results.jsonl. */
  private offsets = new Map<string, number>();
  /** Serializes state writes so overlapping saves cannot corrupt the file. */
  private writeChain: Promise<void> = Promise.resolve();
  private readonly pendingFile: string;

  constructor(config: AgentQueueConfig) {
    this.config = config;
    this.pendingFile = path.join(config.stateDir, "pending.json");
    this.agents = [
      {
        name: config.primaryName,
        triggersDir: config.triggersDir,
        inboxFile: config.inboxFile,
        resultsFile: config.resultsFile,
      },
      ...config.routes,
    ];
  }

  /** The primary agent keeps the historic offset filename; routes get their own. */
  private offsetFileFor(agent: AgentRoute): string {
    const suffix = agent.name === this.config.primaryName ? "" : `-${agent.name}`;
    return path.join(this.config.stateDir, `results${suffix}.offset`);
  }

  /** Ensures directories exist and loads the persisted pending map. */
  async init(): Promise<void> {
    for (const agent of this.agents) {
      await fs.mkdir(agent.triggersDir, { recursive: true });
    }
    await fs.mkdir(this.config.stateDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.pendingFile, "utf8");
      const obj = JSON.parse(raw) as Record<string, ReplyContext>;
      this.pending = new Map(Object.entries(obj));
      if (this.pending.size > 0) {
        log.info(`Loaded ${this.pending.size} pending reply/replies awaiting results.`);
      }
    } catch {
      // No pending file yet — start empty.
    }
    const routeNames = this.config.routes.map((r) => r.name).join(", ") || "(ingen)";
    log.info(`Queue bridge ready. Inbox: ${this.config.inboxFile}. Delegation routes: ${routeNames}`);
  }

  /**
   * Appends an event to the inbox and records where its result should go.
   * The append is a single write, so with a single writer (this process) it is
   * effectively atomic; proxy-agent only ever reads the file.
   */
  async submit(event: QueueEvent, reply: ReplyContext): Promise<void> {
    await fs.appendFile(this.config.inboxFile, JSON.stringify(event) + "\n", "utf8");
    this.pending.set(event.id, reply);
    await this.persistPending();
    log.info(`Queued ${event.source} event "${event.id}" for the agent.`);
  }

  /**
   * Polls every agent's `results.jsonl` for new lines and delivers each answer
   * through the matching poster. Tracks a byte offset per agent (persisted) so
   * results are processed exactly once, and only whole lines (ending in "\n")
   * are consumed.
   */
  async startResultWatcher(posters: ResultPosters, signal: AbortSignal): Promise<void> {
    for (const agent of this.agents) {
      const offset = await this.loadOffset(agent);
      this.offsets.set(agent.name, offset);
      log.info(`Watching results for "${agent.name}" from offset ${offset} in ${agent.resultsFile}.`);
    }

    while (!signal.aborted) {
      for (const agent of this.agents) {
        try {
          const next = await this.drainResults(agent, this.offsets.get(agent.name) ?? 0, posters);
          this.offsets.set(agent.name, next);
        } catch (err) {
          log.error(`Result poll cycle for "${agent.name}" failed; will retry.`, err);
        }
      }
      await sleep(this.config.resultsPollIntervalSeconds * 1000, signal);
    }
  }

  private async drainResults(agent: AgentRoute, offset: number, posters: ResultPosters): Promise<number> {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(agent.resultsFile);
    } catch {
      return offset; // No results file yet.
    }
    if (stat.size <= offset) {
      // File was truncated/rotated — restart from the beginning.
      return stat.size < offset ? 0 : offset;
    }

    const fh = await fs.open(agent.resultsFile, "r");
    let text: string;
    try {
      const buf = Buffer.alloc(stat.size - offset);
      await fh.read(buf, 0, buf.length, offset);
      text = buf.toString("utf8");
    } finally {
      await fh.close();
    }

    const lastNl = text.lastIndexOf("\n");
    if (lastNl === -1) return offset; // No complete line yet.

    const complete = text.slice(0, lastNl + 1);
    for (const line of complete.split("\n")) {
      if (line.trim() === "") continue;
      await this.handleResultLine(agent, line, posters);
    }
    const newOffset = offset + Buffer.byteLength(complete, "utf8");
    await this.saveOffset(agent, newOffset);
    return newOffset;
  }

  private async handleResultLine(agent: AgentRoute, line: string, posters: ResultPosters): Promise<void> {
    let result: ResultLine;
    try {
      result = JSON.parse(line) as ResultLine;
    } catch {
      log.warn(`Skipping malformed results line from "${agent.name}": ${line.slice(0, 200)}`);
      return;
    }

    const reply = this.pending.get(result.id);
    if (!reply) {
      log.debug(`No pending reply for result "${result.id}" — not ours or already handled.`);
      return;
    }

    if (result.status === "ok" && result.intent === "delegate") {
      await this.handleDelegation(agent, result, reply, posters);
      return;
    }

    const delivery = await this.composeDelivery(agent, result);
    const posted = await this.post(reply, delivery, posters, result.id);
    if (!posted) return; // Keep pending; the next cycle retries.
    log.info(`Delivered result "${result.id}" to ${reply.kind} as ${delivery.kind} (intent=${result.intent ?? "?"}).`);

    this.pending.delete(result.id);
    await this.persistPending();
  }

  /**
   * Routes a `delegate` result onwards: appends the task as a new event in the
   * target agent's inbox and remaps the pending reply to the new event id, so
   * the target's eventual result is posted to the original thread/issue. The
   * origin gets an interim notice, but keeps its "working" reaction — the task
   * is still in progress until the target agent answers.
   */
  private async handleDelegation(
    from: AgentRoute,
    result: ResultLine,
    reply: ReplyContext,
    posters: ResultPosters,
  ): Promise<void> {
    const targetName = (result.delegate?.agent ?? "").trim();
    const prompt = (result.delegate?.prompt ?? "").trim();
    const target = this.agents.find((a) => a.name === targetName && a.name !== from.name);
    const hops = (reply.hops ?? 0) + 1;

    let failure = "";
    if (!targetName || !prompt) {
      failure = `Agenten «${from.name}» ville delegere, men resultatet mangler delegate.agent/delegate.prompt.`;
    } else if (!target) {
      failure = `Ingen utførende agent «${targetName}» er konfigurert (AGENT_ROUTES) — kan ikke delegere.`;
    } else if (hops > this.config.maxDelegationHops) {
      failure = `Maks delegeringsdybde (${this.config.maxDelegationHops}) er nådd — stopper hos «${from.name}».`;
    }
    if (failure) {
      log.warn(`Delegation of "${result.id}" rejected: ${failure}`);
      const posted = await this.post(reply, { kind: "message", text: `⚠️ ${failure}` }, posters, result.id);
      if (!posted) return; // Keep pending; the next cycle retries.
      this.pending.delete(result.id);
      await this.persistPending();
      return;
    }

    const newId = `${result.id}-d${hops}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const event: QueueEvent = {
      id: newId,
      source: "agent",
      type: "delegation",
      received_at: new Date().toISOString(),
      prompt,
      payload: {
        ...(result.delegate?.payload ?? {}),
        origin: { agent: from.name, event_id: result.id, hops },
      },
    };
    await fs.appendFile(target!.inboxFile, JSON.stringify(event) + "\n", "utf8");

    this.pending.delete(result.id);
    this.pending.set(newId, { ...reply, hops });
    await this.persistPending();
    log.info(`Delegated "${result.id}" from "${from.name}" to "${target!.name}" as "${newId}".`);

    // Interim notice (best effort — the delegation itself is already done).
    const text = (result.reply ?? "").trim() || `🔁 Delegert til ${target!.name}.`;
    await this.post(reply, { kind: "message", text: truncate(text, this.config.maxReplyChars) }, posters, newId, {
      keepWorking: true,
    });
  }

  /**
   * Posts a delivery to the origin. Returns false when no poster is available
   * or posting failed (callers keep the reply pending and retry later).
   * `keepWorking` strips the working-reaction bookkeeping from the context so
   * the reaction survives an interim message.
   */
  private async post(
    reply: ReplyContext,
    delivery: Delivery,
    posters: ResultPosters,
    id: string,
    opts: { keepWorking?: boolean } = {},
  ): Promise<boolean> {
    let ctx = reply;
    if (opts.keepWorking) {
      ctx = { ...reply };
      if (ctx.kind === "slack") {
        delete ctx.messageTs;
        delete ctx.workingReaction;
      } else {
        delete ctx.reactionsUrl;
        delete ctx.reactionId;
      }
    }
    try {
      if (ctx.kind === "slack" && posters.slack) {
        await posters.slack(ctx, delivery);
      } else if (ctx.kind === "github" && posters.github) {
        await posters.github(ctx, delivery);
      } else {
        log.warn(`No poster registered for ${ctx.kind} — cannot deliver "${id}".`);
        return false;
      }
      return true;
    } catch (err) {
      log.error(`Failed to deliver "${id}" to ${ctx.kind}; will retry.`, err);
      return false;
    }
  }

  /** Decides how to deliver a result: a posted message, or a silent ack. */
  private async composeDelivery(agent: AgentRoute, result: ResultLine): Promise<Delivery> {
    if (result.status !== "ok") {
      const detail = (result.reply ?? "").trim() || (await this.readLog(agent, result)) || `exit code ${result.exit_code ?? "?"}`;
      return { kind: "message", text: truncate(`⚠️ Agenten feilet (${result.status}).\n\n${detail}`, this.config.maxReplyChars) };
    }

    // A pure acknowledgement needs no message — the connector just reacts.
    if (result.intent === "ack") return { kind: "ack" };

    // action / feedback / unknown → post the clean reply, falling back to the
    // raw log for older results that carry no reply field.
    let text = (result.reply ?? "").trim();
    if (!text) text = (await this.readLog(agent, result)) || "✅ Agenten er ferdig, men produserte ingen tekst.";
    return { kind: "message", text: truncate(text, this.config.maxReplyChars) };
  }

  /** Reads the agent's log file for a result (empty string if unavailable). */
  private async readLog(agent: AgentRoute, result: ResultLine): Promise<string> {
    if (!result.log) return "";
    // `result.log` comes from an agent's results line — contain it to the
    // agent's own triggers dir so a stray/hostile "../" or absolute path
    // cannot make integrations read arbitrary files and relay them onwards.
    const base = path.resolve(agent.triggersDir);
    const resolved = path.resolve(base, result.log);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      log.warn(`Refusing to read log outside triggers dir for "${result.id}": ${result.log}`);
      return "";
    }
    try {
      return (await fs.readFile(resolved, "utf8")).trim();
    } catch (err) {
      log.warn(`Could not read log ${result.log} for "${result.id}".`, err);
      return "";
    }
  }

  private async loadOffset(agent: AgentRoute): Promise<number> {
    try {
      const raw = await fs.readFile(this.offsetFileFor(agent), "utf8");
      const n = Number(raw.trim());
      if (Number.isFinite(n) && n >= 0) return n;
    } catch {
      // No offset yet — skip whatever backlog already exists so a fresh start
      // does not replay old results.
    }
    try {
      const stat = await fs.stat(agent.resultsFile);
      await this.saveOffset(agent, stat.size);
      return stat.size;
    } catch {
      return 0; // No results file yet.
    }
  }

  private saveOffset(agent: AgentRoute, offset: number): Promise<void> {
    return this.atomicWrite(this.offsetFileFor(agent), String(offset));
  }

  private persistPending(): Promise<void> {
    const obj = Object.fromEntries(this.pending);
    return this.atomicWrite(this.pendingFile, JSON.stringify(obj, null, 2));
  }

  /** Writes via a temp file + rename, chained so writes never overlap. */
  private atomicWrite(file: string, content: string): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, content, "utf8");
      await fs.rename(tmp, file);
    });
    return this.writeChain;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n… (avkortet, ${text.length - max} tegn utelatt)`;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentQueueConfig } from "../config.ts";
import { createLogger } from "../logger.ts";
import type { Delivery, QueueEvent, ReplyContext, ResultLine, ResultPosters } from "./types.ts";

const log = createLogger("queue");

/**
 * Bridges agent-bot to dd-agent over the shared `triggers/` directory:
 *   - {@link submit} appends an event to `inbox.jsonl` and remembers where its
 *     eventual result should be posted (the pending map, persisted to disk so
 *     it survives restarts between submit and result).
 *   - {@link startResultWatcher} tails `results.jsonl`, reads the matching log,
 *     and hands the answer to the registered posters.
 */
export class AgentQueue {
  private readonly config: AgentQueueConfig;
  /** id -> where to post the result. The source of truth; disk mirrors it. */
  private pending = new Map<string, ReplyContext>();
  /** Serializes state writes so overlapping saves cannot corrupt the file. */
  private writeChain: Promise<void> = Promise.resolve();
  private readonly pendingFile: string;
  private readonly offsetFile: string;

  constructor(config: AgentQueueConfig) {
    this.config = config;
    this.pendingFile = path.join(config.stateDir, "pending.json");
    this.offsetFile = path.join(config.stateDir, "results.offset");
  }

  /** Ensures directories exist and loads the persisted pending map. */
  async init(): Promise<void> {
    await fs.mkdir(this.config.triggersDir, { recursive: true });
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
    log.info(`Queue bridge ready. Inbox: ${this.config.inboxFile}`);
  }

  /**
   * Appends an event to the inbox and records where its result should go.
   * The append is a single write, so with a single writer (this process) it is
   * effectively atomic; dd-agent only ever reads the file.
   */
  async submit(event: QueueEvent, reply: ReplyContext): Promise<void> {
    await fs.appendFile(this.config.inboxFile, JSON.stringify(event) + "\n", "utf8");
    this.pending.set(event.id, reply);
    await this.persistPending();
    log.info(`Queued ${event.source} event "${event.id}" for the agent.`);
  }

  /**
   * Polls `results.jsonl` for new lines and delivers each answer through the
   * matching poster. Tracks a byte offset (persisted) so results are processed
   * exactly once, and only whole lines (ending in "\n") are consumed.
   */
  async startResultWatcher(posters: ResultPosters, signal: AbortSignal): Promise<void> {
    let offset = await this.loadOffset();
    log.info(`Watching results from offset ${offset} in ${this.config.resultsFile}.`);

    while (!signal.aborted) {
      try {
        offset = await this.drainResults(offset, posters);
      } catch (err) {
        log.error("Result poll cycle failed; will retry.", err);
      }
      await sleep(this.config.resultsPollIntervalSeconds * 1000, signal);
    }
  }

  private async drainResults(offset: number, posters: ResultPosters): Promise<number> {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(this.config.resultsFile);
    } catch {
      return offset; // No results file yet.
    }
    if (stat.size <= offset) {
      // File was truncated/rotated — restart from the beginning.
      return stat.size < offset ? 0 : offset;
    }

    const fh = await fs.open(this.config.resultsFile, "r");
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
      await this.handleResultLine(line, posters);
    }
    const newOffset = offset + Buffer.byteLength(complete, "utf8");
    await this.saveOffset(newOffset);
    return newOffset;
  }

  private async handleResultLine(line: string, posters: ResultPosters): Promise<void> {
    let result: ResultLine;
    try {
      result = JSON.parse(line) as ResultLine;
    } catch {
      log.warn(`Skipping malformed results line: ${line.slice(0, 200)}`);
      return;
    }

    const reply = this.pending.get(result.id);
    if (!reply) {
      log.debug(`No pending reply for result "${result.id}" — not ours or already handled.`);
      return;
    }

    const delivery = await this.composeDelivery(result);
    try {
      if (reply.kind === "slack" && posters.slack) {
        await posters.slack(reply, delivery);
      } else if (reply.kind === "github" && posters.github) {
        await posters.github(reply, delivery);
      } else {
        log.warn(`No poster registered for ${reply.kind} — cannot deliver result "${result.id}".`);
        return; // Keep it pending in case the connector comes back.
      }
      log.info(`Delivered result "${result.id}" to ${reply.kind} as ${delivery.kind} (intent=${result.intent ?? "?"}).`);
    } catch (err) {
      log.error(`Failed to deliver result "${result.id}" to ${reply.kind}; will retry.`, err);
      return; // Leave pending so the next cycle retries.
    }

    this.pending.delete(result.id);
    await this.persistPending();
  }

  /** Decides how to deliver a result: a posted message, or a silent ack. */
  private async composeDelivery(result: ResultLine): Promise<Delivery> {
    if (result.status !== "ok") {
      const detail = (result.reply ?? "").trim() || (await this.readLog(result)) || `exit code ${result.exit_code ?? "?"}`;
      return { kind: "message", text: truncate(`⚠️ Agenten feilet (${result.status}).\n\n${detail}`, this.config.maxReplyChars) };
    }

    // A pure acknowledgement needs no message — the connector just reacts.
    if (result.intent === "ack") return { kind: "ack" };

    // action / feedback / unknown → post the clean reply, falling back to the
    // raw log for older results that carry no reply field.
    let text = (result.reply ?? "").trim();
    if (!text) text = (await this.readLog(result)) || "✅ Agenten er ferdig, men produserte ingen tekst.";
    return { kind: "message", text: truncate(text, this.config.maxReplyChars) };
  }

  /** Reads the agent's log file for a result (empty string if unavailable). */
  private async readLog(result: ResultLine): Promise<string> {
    if (!result.log) return "";
    try {
      return (await fs.readFile(path.join(this.config.triggersDir, result.log), "utf8")).trim();
    } catch (err) {
      log.warn(`Could not read log ${result.log} for "${result.id}".`, err);
      return "";
    }
  }

  private async loadOffset(): Promise<number> {
    try {
      const raw = await fs.readFile(this.offsetFile, "utf8");
      const n = Number(raw.trim());
      if (Number.isFinite(n) && n >= 0) return n;
    } catch {
      // No offset yet — skip whatever backlog already exists so a fresh start
      // does not replay old results.
    }
    try {
      const stat = await fs.stat(this.config.resultsFile);
      await this.saveOffset(stat.size);
      return stat.size;
    } catch {
      return 0; // No results file yet.
    }
  }

  private saveOffset(offset: number): Promise<void> {
    return this.atomicWrite(this.offsetFile, String(offset));
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

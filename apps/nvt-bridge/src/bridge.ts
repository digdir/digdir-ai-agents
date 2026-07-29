import type { NvtDriver } from "./nvt/driver.ts";
import { fallbackReply, renderPrompt } from "./prompt.ts";
import { TopicScheduler } from "./scheduler.ts";
import type { TopicStore } from "./state.ts";
import { instanceNameFor, type InstanceNameOptions } from "./topic.ts";
import { topicFor } from "./topic.ts";
import { pendingEvents, type TriggerFiles } from "./triggers.ts";
import type { QueueEvent } from "./types.ts";

export interface BridgeOptions {
  triggers: TriggerFiles;
  store: TopicStore;
  driver: NvtDriver;
  instanceNaming: InstanceNameOptions;
  maxParallel: number;
  /** Hvor lenge vi venter på `agentdctl signal done`. */
  promptTimeoutMs: number;
  /** Nådefrist for resultatlinja etter `signal done`. */
  resultGraceMs: number;
  /** TTL for `agent-down` av inaktive topics. 0 = av. */
  idleTtlMs: number;
  log?: (message: string) => void;
  /** Injiserbar for tester. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Broen mellom filkontrakten og levende nvt-instanser.
 *
 * Invariantene, i prioritert rekkefølge:
 *
 * 1. **Hvert dispatchet event ender med en resultatlinje.** Uten den er
 *    eventet evig ubehandlet, og polleren ville dispatche det på nytt i
 *    ring. Dette er samme grunn som at agent-entrypointene har en
 *    EXIT-trap; her er det try/catch rundt hele `handleEvent`.
 * 2. **Aldri en fabrikert suksess.** Broen skriver kun `status:"error"`
 *    selv. En `status:"ok"` kan bare komme fra agenten i instansen.
 * 3. **Serielt per topic** — én levende sesjon og én arbeidskopi per topic.
 */
export class NvtBridge {
  readonly scheduler: TopicScheduler;
  private readonly opts: BridgeOptions;
  private readonly log: (message: string) => void;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: BridgeOptions) {
    this.opts = opts;
    this.log = opts.log ?? (() => {});
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.scheduler = new TopicScheduler({
      maxParallel: opts.maxParallel,
      handler: (event, topic) => this.handleEvent(event, topic),
      onError: (event, topic, err) =>
        this.log(`topic ${topic}: event ${event.id} feilet uventet: ${describe(err)}`),
    });
  }

  /** Én pollesyklus: finn ubehandlede events, kø dem, rydd inaktive topics. */
  async pollOnce(): Promise<void> {
    const [inbox, doneIds] = await Promise.all([
      this.opts.triggers.readInbox(),
      this.opts.triggers.readResultIds(),
    ]);
    for (const event of pendingEvents(inbox, doneIds, this.scheduler.inFlightIds())) {
      const topic = topicFor(event);
      if (this.scheduler.enqueue(event, topic)) {
        this.log(`topic ${topic}: køet event ${event.id}`);
      }
    }
    this.scheduler.pump();
    await this.sweepIdleTopics();
  }

  /** Poll-løkka. Kjører til `signal` aborteres. */
  async run(pollMs: number, signal?: AbortSignal): Promise<void> {
    await this.opts.triggers.ensureDirs();
    await this.opts.store.load();
    this.log(
      `bridge startet: poller ${this.opts.triggers.inboxFile} hvert ${Math.round(pollMs / 1000)}s ` +
        `(maks ${this.opts.maxParallel} parallelle topics)`,
    );
    while (!signal?.aborted) {
      try {
        await this.pollOnce();
      } catch (err) {
        // En feilende pollesyklus skal ikke drepe brua.
        this.log(`pollesyklus feilet: ${describe(err)}`);
      }
      await this.sleep(pollMs);
    }
  }

  /**
   * Behandler ett event: sørg for instans, injiser prompt, vent på at agenten
   * melder seg ferdig, og verifiser at resultatlinja faktisk kom.
   */
  private async handleEvent(event: QueueEvent, topic: string): Promise<void> {
    const started_at = new Date().toISOString();
    const instanceName = instanceNameFor(topic, this.opts.instanceNaming);
    await this.opts.triggers.appendBridgeLog(
      event.id,
      `dispatch: topic=${topic} instans=${instanceName}`,
    );

    try {
      await this.opts.store.upsert(topic, instanceName);
      const record = this.opts.store.get(topic);
      // State er sannheten når den finnes: et topic som allerede har en
      // instans skal ikke bytte navn (og dermed workspace) om navnereglene
      // endres mellom kjøringer.
      const instance = record?.instance ?? instanceName;

      const ref = await this.opts.driver.ensureInstance(topic, instance);
      this.log(`topic ${topic}: instans ${instance} klar, injiserer event ${event.id}`);

      await this.opts.driver.sendPrompt(ref, renderPrompt(event, topic));
      await this.opts.store.markPrompted(topic, event.id);
      await this.opts.triggers.appendBridgeLog(event.id, "prompt injisert, venter på signal done");

      const outcome = await this.opts.driver.waitForDone(ref, {
        timeoutMs: this.opts.promptTimeoutMs,
      });

      // Agenten skriver resultatlinja selv. Etter `signal done` gir vi den en
      // nådefrist; ved timeout er det ingen grunn til å vente mer, men vi
      // sjekker én gang — agenten kan ha levert uten å signalisere.
      const graceMs = outcome.kind === "done" ? this.opts.resultGraceMs : 0;
      await this.opts.triggers.appendBridgeLog(
        event.id,
        outcome.kind === "done"
          ? `signal done mottatt ${outcome.at}, venter opptil ${graceMs}ms på resultatlinja`
          : `ingen signal done innen ${outcome.waitedMs}ms`,
      );

      if (await this.awaitResultLine(event.id, graceMs)) {
        this.log(`topic ${topic}: event ${event.id} kvittert ut av agenten`);
        await this.opts.triggers.appendBridgeLog(event.id, "resultatlinje fra agenten funnet");
        return;
      }

      const reason = outcome.kind === "done" ? "done-without-result" : "timeout";
      await this.writeFallback(event, topic, instance, started_at, reason);
    } catch (err) {
      // Interne feil (instans nede, make/docker feilet) skal også ende i en
      // resultatlinje — ellers spinner polleren på eventet for alltid.
      await this.opts.triggers.appendBridgeLog(event.id, `intern feil: ${describe(err)}`);
      if (!(await this.opts.triggers.hasResult(event.id))) {
        await this.opts.triggers.appendResult({
          id: event.id,
          status: "error",
          exit_code: 1,
          log: this.opts.triggers.bridgeLogRelPath(event.id),
          intent: "action",
          reply:
            `nvt-broen fikk ikke levert oppgaven til en agentinstans: ${describe(err)}. ` +
            `Ingen leveranse er bekreftet. Topic \`${topic}\`.`,
          started_at,
          finished_at: new Date().toISOString(),
        });
      }
    }
  }

  /** Fallback-linja: alltid `status:"error"`, aldri en fabrikert suksess. */
  private async writeFallback(
    event: QueueEvent,
    topic: string,
    instance: string,
    started_at: string,
    reason: "done-without-result" | "timeout",
  ): Promise<void> {
    const reply = fallbackReply(reason, {
      instance,
      topic,
      graceSeconds: Math.round(this.opts.resultGraceMs / 1000),
      timeoutSeconds: Math.round(this.opts.promptTimeoutMs / 1000),
    });
    await this.opts.triggers.appendResult({
      id: event.id,
      status: "error",
      exit_code: 1,
      log: this.opts.triggers.bridgeLogRelPath(event.id),
      intent: "action",
      reply,
      started_at,
      finished_at: new Date().toISOString(),
    });
    this.log(`topic ${topic}: event ${event.id} → fallback-resultatlinje (${reason})`);
    await this.opts.triggers.appendBridgeLog(event.id, `fallback-resultatlinje skrevet (${reason})`);
  }

  /**
   * Venter opptil `graceMs` på at resultatlinja for `id` dukker opp. Sjekker
   * alltid minst én gang, og rett før fallbacken skrives — det minsker vinduet
   * der både agenten og broen skriver en linje for samme id.
   */
  private async awaitResultLine(id: string, graceMs: number): Promise<boolean> {
    const step = 500;
    let waited = 0;
    for (;;) {
      if (await this.opts.triggers.hasResult(id)) return true;
      if (waited >= graceMs) return false;
      await this.sleep(Math.min(step, graceMs - waited));
      waited += step;
    }
  }

  /** TTL: `agent-down` for topics uten aktivitet. Workspacet beholdes. */
  private async sweepIdleTopics(): Promise<void> {
    for (const [topic, record] of this.opts.store.idleTopics(this.opts.idleTtlMs)) {
      if (this.scheduler.isBusy(topic)) continue;
      try {
        await this.opts.driver.stopInstance({ topic, instance: record.instance });
        await this.opts.store.markDown(topic);
        this.log(`topic ${topic}: instans ${record.instance} tatt ned (inaktiv), workspace beholdt`);
      } catch (err) {
        this.log(`topic ${topic}: agent-down feilet: ${describe(err)}`);
      }
    }
  }
}

function describe(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split("\n")[0]?.trim() || "ukjent feil";
}

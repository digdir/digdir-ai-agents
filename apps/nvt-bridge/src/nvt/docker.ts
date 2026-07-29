import { spawn } from "node:child_process";
import type { DoneOutcome, NvtDriver, NvtInstance } from "./driver.ts";

/**
 * ==========================================================================
 *  KALIBRERES MOT M0-FUNN (issue #96) — ikke verifisert mot en ekte instans.
 * ==========================================================================
 *
 * Tynn adapter over nvt-agents lokale compose-flyt. Den er bevisst så tynn
 * som mulig: alle antakelser om nvt-oppsettet bor HER, og ingen andre steder
 * i bridgen. Kjernelogikken testes mot `FakeNvtDriver` og er uavhengig av
 * hvordan denne fila ender opp.
 *
 * Disse punktene er ubekreftet til M0 er kjørt, og er de eneste som skal
 * trenge endring etterpå:
 *
 * - **Make-målene**: `make agent-init NAME=<n> TYPE=<t>` og
 *   `make agent-up NAME=<n>` / `make agent-down NAME=<n>`, kjørt med
 *   `NVT_ROOT` som cwd. Signaturene er lest ut av planen, ikke prøvd.
 * - **Containernavnet**: planen skriver `agent-<navn>-agent-1` (compose sitt
 *   default `<prosjekt>-<tjeneste>-<n>`). Er tjenestenavnet eller
 *   prosjektprefikset noe annet, er `containerName()` det ene stedet å rette.
 * - **`agentdctl`-stien og subscribe-formatet**: vi antar `agentdctl` på PATH
 *   i runtime-containeren, at `subscribe` skriver JSONL til stdout, og at
 *   done-eventet har `type` (eller `event`) `plugin.agent.signal.done`.
 *   `isDoneEvent()` godtar begge feltnavn nettopp fordi dette er uverifisert.
 * - **Nettverk/host-oppslag** (`network_mode: service:docker`,
 *   `host.docker.internal`) berøres IKKE herfra. Det er instans-config i
 *   `.agents/<navn>/env` og hører til M0-oppsettet, ikke til bridgen.
 * - **Bind-mount-fella**: compose-mounts løses av *hostens* daemon, så
 *   `NVT_ROOT` og triggers-stien må være identiske inne i bridge-containeren
 *   og på hosten. Adapteren gjør ingen sti-oversetting — det er et bevisst
 *   valg, ikke en glipp.
 */

export interface DockerNvtDriverOptions {
  /** Sjekkouten av nvt-agent — cwd for make-kallene. */
  nvtRoot: string;
  /** Agent-type til `agent-init` (f.eks. `claude`). */
  agentType: string;
  /** Overstyring for testing/tørrkjøring. */
  exec?: ExecFn;
  log?: (message: string) => void;
}

export type ExecFn = (
  cmd: string,
  args: string[],
  opts: { cwd?: string },
) => Promise<{ code: number; stdout: string; stderr: string }>;

export class DockerNvtDriver implements NvtDriver {
  private readonly opts: DockerNvtDriverOptions;
  private readonly exec: ExecFn;
  private readonly log: (message: string) => void;
  /** Instanser vi har kjørt `agent-up` for i denne prosessen. */
  private readonly started = new Set<string>();

  constructor(opts: DockerNvtDriverOptions) {
    this.opts = opts;
    this.exec = opts.exec ?? runCommand;
    this.log = opts.log ?? (() => {});
  }

  /**
   * Compose-container for instansens runtime. Se advarselen øverst — dette
   * navnet er det mest sannsynlige M0 må rette.
   */
  containerName(instance: string): string {
    return `agent-${instance}-agent-1`;
  }

  async ensureInstance(topic: string, instance: string): Promise<NvtInstance> {
    const ref: NvtInstance = { topic, instance };
    if (this.started.has(instance) && (await this.isRunning(instance))) {
      return ref;
    }
    // `agent-init` er idempotent i nvt (skriver/oppdaterer `.agents/<navn>/`);
    // vi kjører den likevel bare når instansen ikke er oppe, for å ikke
    // overskrive en config et menneske har justert i en levende sesjon.
    if (!(await this.isRunning(instance))) {
      this.log(`agent-init NAME=${instance} TYPE=${this.opts.agentType}`);
      await this.make(["agent-init", `NAME=${instance}`, `TYPE=${this.opts.agentType}`]);
      this.log(`agent-up NAME=${instance}`);
      await this.make(["agent-up", `NAME=${instance}`]);
    }
    this.started.add(instance);
    return ref;
  }

  async sendPrompt(instance: NvtInstance, prompt: string): Promise<void> {
    // `--external` er ikke valgfritt: delegerte prompts er upålitelig input,
    // og flagget er det som gir nvt sin «untrusted input»-preamble.
    const { code, stderr } = await this.exec(
      "docker",
      [
        "exec",
        this.containerName(instance.instance),
        "agentdctl",
        "prompt",
        "--source",
        "host",
        "--external",
        prompt,
      ],
      {},
    );
    if (code !== 0) {
      throw new Error(
        `agentdctl prompt feilet for ${instance.instance} (exit ${code}): ${firstLine(stderr)}`,
      );
    }
  }

  async waitForDone(
    instance: NvtInstance,
    opts: { timeoutMs: number; signal?: AbortSignal },
  ): Promise<DoneOutcome> {
    const started = Date.now();
    return await new Promise<DoneOutcome>((resolve) => {
      const child = spawn(
        "docker",
        ["exec", this.containerName(instance.instance), "agentdctl", "subscribe"],
        { stdio: ["ignore", "pipe", "ignore"] },
      );
      let settled = false;
      let buffer = "";

      const finish = (outcome: DoneOutcome) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        opts.signal?.removeEventListener("abort", onAbort);
        child.kill("SIGTERM");
        resolve(outcome);
      };
      const onAbort = () =>
        finish({ kind: "timeout", waitedMs: Date.now() - started });
      const timer = setTimeout(
        () => finish({ kind: "timeout", waitedMs: Date.now() - started }),
        opts.timeoutMs,
      );
      timer.unref?.();
      opts.signal?.addEventListener("abort", onAbort, { once: true });

      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        buffer += chunk;
        const lastNl = buffer.lastIndexOf("\n");
        if (lastNl === -1) return;
        const lines = buffer.slice(0, lastNl).split("\n");
        buffer = buffer.slice(lastNl + 1);
        for (const line of lines) {
          if (isDoneEvent(line)) {
            finish({ kind: "done", at: new Date().toISOString() });
            return;
          }
        }
      });
      // Dør subscribe (instansen nede, feil containernavn), er det ikke et
      // «done» — da skal bridgen skrive en error-linje, ikke anta suksess.
      child.on("error", onAbort);
      child.on("exit", () => {
        if (!settled) {
          finish({ kind: "timeout", waitedMs: Date.now() - started });
        }
      });
    });
  }

  async stopInstance(instance: NvtInstance): Promise<void> {
    this.log(`agent-down NAME=${instance.instance}`);
    await this.make(["agent-down", `NAME=${instance.instance}`]);
    this.started.delete(instance.instance);
  }

  private async make(args: string[]): Promise<void> {
    const { code, stderr } = await this.exec("make", args, {
      cwd: this.opts.nvtRoot,
    });
    if (code !== 0) {
      throw new Error(`make ${args.join(" ")} feilet (exit ${code}): ${firstLine(stderr)}`);
    }
  }

  private async isRunning(instance: string): Promise<boolean> {
    const { code, stdout } = await this.exec(
      "docker",
      ["inspect", "-f", "{{.State.Running}}", this.containerName(instance)],
      {},
    );
    return code === 0 && stdout.trim() === "true";
  }
}

/**
 * Godtar både `type` og `event` som feltnavn — hvilket nvt faktisk bruker er
 * et M0-spørsmål. Ugyldige linjer ignoreres.
 */
export function isDoneEvent(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === "") return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return false;
  }
  const obj = parsed as { type?: unknown; event?: unknown };
  const name = typeof obj.type === "string" ? obj.type : obj.event;
  return name === "plugin.agent.signal.done";
}

function firstLine(text: string): string {
  return text.split("\n").find((l) => l.trim() !== "")?.trim() ?? "";
}

const runCommand: ExecFn = (cmd, args, opts) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (c: string) => (stdout += c));
    child.stderr?.on("data", (c: string) => (stderr += c));
    child.on("error", (err) => resolve({ code: -1, stdout, stderr: String(err) }));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });

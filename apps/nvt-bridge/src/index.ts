import { NvtBridge } from "./bridge.ts";
import { loadConfig } from "./config.ts";
import { DockerNvtDriver } from "./nvt/docker.ts";
import { DryRunNvtDriver } from "./nvt/dryrun.ts";
import type { NvtDriver } from "./nvt/driver.ts";
import { TopicStore } from "./state.ts";
import { TriggerFiles } from "./triggers.ts";

/** Tidsstemplet logg til stdout. Aldri hemmeligheter her — kun id-er og navn. */
function log(message: string): void {
  console.log(`[${new Date().toISOString()}] [nvt-bridge] ${message}`);
}

// Null runtime-avhengigheter: Node laster .env selv (21.7+). Mangler filen,
// kommer configen fra prosessmiljøet (compose `env_file`).
try {
  process.loadEnvFile();
} catch {
  // Ingen .env — helt greit.
}

const config = loadConfig();

const driver: NvtDriver = config.dryRun
  ? new DryRunNvtDriver(log)
  : new DockerNvtDriver({ nvtRoot: config.nvtRoot, agentType: config.agentType, log });

if (config.dryRun) {
  log("TØRRKJØRING (NVT_BRIDGE_DRY_RUN=1): ingen nvt-instanser startes");
}

const bridge = new NvtBridge({
  triggers: new TriggerFiles(config.triggersDir),
  store: new TopicStore(config.stateDir),
  driver,
  instanceNaming: config.instanceNaming,
  maxParallel: config.maxParallel,
  promptTimeoutMs: config.promptTimeoutMs,
  resultGraceMs: config.resultGraceMs,
  idleTtlMs: config.idleTtlMs,
  log,
});

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log(`${signal} mottatt — avslutter etter inneværende syklus`);
    controller.abort();
  });
}

await bridge.run(config.pollMs, controller.signal);

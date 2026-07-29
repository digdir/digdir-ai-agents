import path from "node:path";
import type { InstanceNameOptions } from "./topic.ts";

export interface BridgeConfig {
  triggersDir: string;
  stateDir: string;
  pollMs: number;
  maxParallel: number;
  promptTimeoutMs: number;
  resultGraceMs: number;
  idleTtlMs: number;
  nvtRoot: string;
  agentType: string;
  instanceNaming: InstanceNameOptions;
  dryRun: boolean;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): BridgeConfig {
  const dryRun = boolFrom(env.NVT_BRIDGE_DRY_RUN);
  const nvtRoot = (env.NVT_ROOT ?? "").trim();
  if (!dryRun && nvtRoot === "") {
    throw new Error(
      "NVT_ROOT må peke på nvt-agent-sjekkouten (eller sett NVT_BRIDGE_DRY_RUN=1). " +
        "Kopiér .env.example til .env.",
    );
  }
  return {
    triggersDir: path.resolve(
      cwd,
      (env.NVT_BRIDGE_TRIGGERS_DIR ?? "../../agents/nvt-fat-developer/triggers").trim(),
    ),
    stateDir: path.resolve(cwd, (env.NVT_BRIDGE_STATE_DIR ?? "./state").trim()),
    pollMs: intFrom(env.NVT_BRIDGE_POLL_SECONDS, 10, "NVT_BRIDGE_POLL_SECONDS", 1) * 1000,
    maxParallel: intFrom(env.NVT_BRIDGE_MAX_PARALLEL, 2, "NVT_BRIDGE_MAX_PARALLEL", 1),
    promptTimeoutMs:
      intFrom(env.NVT_BRIDGE_PROMPT_TIMEOUT_SECONDS, 3600, "NVT_BRIDGE_PROMPT_TIMEOUT_SECONDS", 1) *
      1000,
    resultGraceMs:
      intFrom(env.NVT_BRIDGE_RESULT_GRACE_SECONDS, 60, "NVT_BRIDGE_RESULT_GRACE_SECONDS", 0) * 1000,
    idleTtlMs:
      intFrom(env.NVT_BRIDGE_IDLE_TTL_MINUTES, 180, "NVT_BRIDGE_IDLE_TTL_MINUTES", 0) * 60_000,
    nvtRoot,
    agentType: (env.NVT_AGENT_TYPE ?? "claude").trim(),
    instanceNaming: {
      prefix: (env.NVT_INSTANCE_PREFIX ?? "fatdev").trim(),
      maxLength: intFrom(env.NVT_INSTANCE_NAME_MAX, 40, "NVT_INSTANCE_NAME_MAX", 16),
    },
    dryRun,
  };
}

function intFrom(raw: string | undefined, fallback: number, name: string, min: number): number {
  const value = (raw ?? "").trim();
  if (value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${name}: forventet et heltall >= ${min}, fikk "${value}"`);
  }
  return parsed;
}

function boolFrom(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

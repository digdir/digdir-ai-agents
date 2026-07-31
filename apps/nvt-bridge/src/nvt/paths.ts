import { stat } from "node:fs/promises";
import path from "node:path";

/**
 * Sti-validering mot M0-funn 2: nvt-sjekkouten (og alt annet som
 * bind-mountes inn i instansen) må ligge et sted **uid 1000 kommer gjennom**.
 *
 * Hvorfor det er et reelt problem og ikke teori: workspacet bind-mountes på
 * samme absolutte sti inne i containeren, og i non-root-modus kjører agenten
 * som `1000:1000`. Ligger sjekkouten under `/root` (mode 700, eier 0), får
 * bootstrap `Permission denied` — men først *inne* i containeren, som en
 * kryptisk feil langt fra årsaken. M0 brant en økt på nettopp dette, så broen
 * sier det fra før den starter å polle.
 *
 * Sjekken er en *host*-sjekk og kjøres bare på Linux. Docker Desktop på macOS
 * mapper eierskap i virtiofs-laget, så de samme mode-bitene der ville gitt
 * falske avvisninger — se `assertAgentCanTraverse`.
 */

/** Uid/gid agenten kjører som i nvt-ens non-root-modus (`--user non-root`). */
export const AGENT_UID = 1000;
export const AGENT_GID = 1000;

export interface StatResult {
  mode: number;
  uid: number;
  gid: number;
}

export type StatFn = (target: string) => Promise<StatResult>;

export interface TraversalProblem {
  path: string;
  /** Mangler stien helt, er `mode`/`uid` ukjent. */
  reason: "missing" | "not-traversable";
  mode?: number;
  uid?: number;
}

/** `/srv/nvt-agent` → `["/", "/srv", "/srv/nvt-agent"]`. */
export function ancestorPaths(absolute: string): string[] {
  const normalized = path.posix.normalize(absolute);
  const segments = normalized.split("/").filter((s) => s !== "");
  const out = ["/"];
  let current = "";
  for (const segment of segments) {
    current += `/${segment}`;
    out.push(current);
  }
  return out;
}

/**
 * Kan uid 1000 traversere (`x`) denne katalogen? Vi ser bare på traverserings-
 * biten: lese- og skrivetilgang på selve innholdet er en annen sak, og den
 * feiler i det minste med en forståelig melding.
 */
export function agentCanTraverse(info: StatResult): boolean {
  if ((info.mode & 0o001) !== 0) return true;
  if (info.uid === AGENT_UID && (info.mode & 0o100) !== 0) return true;
  if (info.gid === AGENT_GID && (info.mode & 0o010) !== 0) return true;
  return false;
}

/** Alle ledd i stien uid 1000 ikke kommer gjennom, øverste først. */
export async function traversalProblems(
  absolute: string,
  statFn: StatFn = defaultStat,
): Promise<TraversalProblem[]> {
  const problems: TraversalProblem[] = [];
  for (const dir of ancestorPaths(absolute)) {
    let info: StatResult;
    try {
      info = await statFn(dir);
    } catch {
      problems.push({ path: dir, reason: "missing" });
      // Finnes ikke leddet, sier resten av stien ingenting.
      break;
    }
    if (!agentCanTraverse(info)) {
      problems.push({
        path: dir,
        reason: "not-traversable",
        mode: info.mode & 0o7777,
        uid: info.uid,
      });
    }
  }
  return problems;
}

export interface PathCheckOptions {
  statFn?: StatFn;
  /** Default `process.platform`. Håndheves bare på Linux (se over). */
  platform?: string;
  /** Rømningsluke: `NVT_BRIDGE_SKIP_PATH_CHECK=1`. */
  skip?: boolean;
  log?: (message: string) => void;
}

/**
 * Fail-fast før broen begynner å polle: kaster med en melding som peker på
 * *hvilket* ledd i stien som stopper uid 1000, og hva man gjør med det.
 *
 * På andre plattformer enn Linux logges funnene som en advarsel i stedet for å
 * kaste: mode-bitene på hosten er da ikke det agenten faktisk møter.
 */
export async function assertAgentCanTraverse(
  label: string,
  absolute: string,
  opts: PathCheckOptions = {},
): Promise<void> {
  const log = opts.log ?? (() => {});
  if (opts.skip) {
    log(`${label}: sti-sjekken er hoppet over (NVT_BRIDGE_SKIP_PATH_CHECK)`);
    return;
  }
  if (!path.posix.isAbsolute(absolute)) {
    throw new Error(
      `${label} må være en absolutt sti (fikk "${absolute}"). ` +
        `Bind-mounts løses av hostens Docker-daemon, så relative stier kan ikke oversettes.`,
    );
  }

  const problems = await traversalProblems(absolute, opts.statFn);
  if (problems.length === 0) return;

  const details = problems
    .map((p) =>
      p.reason === "missing"
        ? `${p.path} (finnes ikke, eller broen får ikke lese den)`
        : `${p.path} (mode ${(p.mode ?? 0).toString(8).padStart(4, "0")}, eier uid ${p.uid})`,
    )
    .join(", ");
  const message =
    `${label}="${absolute}" ligger bak katalog(er) som uid ${AGENT_UID} ikke kommer gjennom: ` +
    `${details}. Agenten kjører som ${AGENT_UID}:${AGENT_GID} (nvt --user non-root) og får ` +
    `«Permission denied» i bootstrap. Flytt sjekkouten til en sti alle kan traversere ` +
    `(f.eks. /srv/nvt-agent), eller gi leddet +x. Kjent M0-felle: /root er mode 0700.`;

  const platform = opts.platform ?? process.platform;
  if (platform !== "linux") {
    log(`ADVARSEL: ${message} (ikke håndhevet på ${platform})`);
    return;
  }
  throw new Error(message);
}

const defaultStat: StatFn = async (target) => {
  const info = await stat(target);
  return { mode: info.mode, uid: info.uid, gid: info.gid };
};

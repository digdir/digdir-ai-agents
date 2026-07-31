/**
 * Klar-tilstand for CLI-sesjonen i instansen (M0-funn 5).
 *
 * `agentd` venter selv på at `session-launched`-markøren og tmux-sesjonen
 * finnes før den køer en prompt — men det sier bare at *tmux* lever. Claude kan
 * fortsatt stå på velkomstskjermen eller i trust-dialogen, og da går prompten
 * inn i dialogen i stedet for i sesjonen. Oppgaven forsvinner uten spor: ingen
 * feil, ingen `signal done`, bare en time med venting.
 *
 * Derfor leser broen tmux-panelet og klassifiserer det. Det er
 * mønstergjenkjenning mot et TUI, altså heuristikk — så mønstrene kan
 * overstyres med env (`NVT_READY_PATTERN`, `NVT_ONBOARDING_PATTERN`) uten
 * kodeendring når claude bytter ordlyd.
 */

export type PaneState =
  /** En onboarding-dialog står i veien. Et Enter tar oss videre. */
  | "onboarding"
  /** Sesjonen viser klar-prompt: trygt å injisere. */
  | "ready"
  /** Verken/eller — sesjonen kan være midt i arbeid, eller ikke tegnet ennå. */
  | "unknown";

/**
 * Skjermene som spiser prompten. `Press Enter to continue` og trust-dialogen er
 * de som traff i M0; resten er de andre førstegangsskjermene claude kan vise.
 */
export const DEFAULT_ONBOARDING_PATTERN =
  /(Welcome to Claude Code|Do you trust the files|trust the files in this folder|Press Enter to continue|Choose the text style|Yes, proceed)/i;

/**
 * Klar-prompten. `? for shortcuts` er footeren claude viser når input-boksen
 * tar imot tekst; `Bypassing Permissions` er indikatoren i
 * `--dangerously-skip-permissions`-modus.
 */
export const DEFAULT_READY_PATTERN = /(\? for shortcuts|Bypassing Permissions|│\s*>)/;

export interface PanePatterns {
  ready: RegExp;
  onboarding: RegExp;
}

export const DEFAULT_PANE_PATTERNS: PanePatterns = {
  ready: DEFAULT_READY_PATTERN,
  onboarding: DEFAULT_ONBOARDING_PATTERN,
};

/**
 * Onboarding vinner over klar-prompt: en dialog kan være tegnet oppå en sesjon
 * som ellers viser footeren, og da er det dialogen som får tastetrykket. Å
 * gjette «ready» der ville vært å injisere inn i dialogen — nøyaktig feilen vi
 * prøver å unngå.
 */
export function classifyPane(
  paneText: string,
  patterns: PanePatterns = DEFAULT_PANE_PATTERNS,
): PaneState {
  if (patterns.onboarding.test(paneText)) return "onboarding";
  if (patterns.ready.test(paneText)) return "ready";
  return "unknown";
}

/**
 * Bygger et mønster fra env. Ugyldig regex skal stoppe oppstarten, ikke gi en
 * sesjon som aldri blir «klar».
 */
export function patternFromEnv(raw: string | undefined, fallback: RegExp, name: string): RegExp {
  const value = (raw ?? "").trim();
  if (value === "") return fallback;
  try {
    return new RegExp(value, "i");
  } catch (err) {
    throw new Error(`${name}: ugyldig regulært uttrykk (${err instanceof Error ? err.message : err})`);
  }
}

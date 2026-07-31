import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPane, DEFAULT_READY_PATTERN, patternFromEnv } from "./ready.ts";

test("velkomstskjerm og trust-dialog klassifiseres som onboarding", () => {
  assert.equal(classifyPane("╭─ Welcome to Claude Code ─╮"), "onboarding");
  assert.equal(classifyPane("Do you trust the files in this folder?"), "onboarding");
  assert.equal(classifyPane("  Press Enter to continue…"), "onboarding");
});

test("klar-prompten klassifiseres som ready", () => {
  assert.equal(classifyPane("│ > │\n  ? for shortcuts"), "ready");
  assert.equal(classifyPane("⏵⏵ Bypassing Permissions"), "ready");
});

test("en onboarding-dialog oppå en ellers klar sesjon er IKKE klar", () => {
  const pane = ["│ >", "? for shortcuts", "Do you trust the files in this folder?"].join("\n");
  assert.equal(
    classifyPane(pane),
    "onboarding",
    "dialogen fanger tastetrykket — å gjette «ready» her er nettopp M0-feilen",
  );
});

test("et panel som jobber er verken onboarding eller ready", () => {
  assert.equal(classifyPane("● Kjører tester …\n  npm test"), "unknown");
  assert.equal(classifyPane(""), "unknown");
});

test("mønstre kan overstyres fra env, og ugyldig regex stopper oppstarten", () => {
  const custom = patternFromEnv("klar til bruk", DEFAULT_READY_PATTERN, "NVT_READY_PATTERN");
  assert.equal(classifyPane("KLAR TIL BRUK", { ready: custom, onboarding: /aldri/ }), "ready");
  assert.equal(patternFromEnv("  ", DEFAULT_READY_PATTERN, "x"), DEFAULT_READY_PATTERN);
  assert.throws(() => patternFromEnv("(ubalansert", DEFAULT_READY_PATTERN, "NVT_READY_PATTERN"), /NVT_READY_PATTERN/);
});

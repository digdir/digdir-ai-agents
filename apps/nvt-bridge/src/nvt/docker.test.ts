import assert from "node:assert/strict";
import { test } from "node:test";
import { DockerNvtDriver, isDoneEvent, type ExecFn } from "./docker.ts";

/**
 * Adapteren er uverifisert mot en ekte instans (kalibreres mot M0-funn), så
 * testene her dekker bare det som er ren logikk: kommandoene som bygges og
 * gjenkjenningen av done-eventet.
 */

test("isDoneEvent gjenkjenner plugin.agent.signal.done på begge feltnavn", () => {
  assert.equal(isDoneEvent('{"type":"plugin.agent.signal.done"}'), true);
  assert.equal(isDoneEvent('{"event":"plugin.agent.signal.done","ts":"t"}'), true);
});

test("isDoneEvent ignorerer andre events, støy og ugyldig JSON", () => {
  assert.equal(isDoneEvent('{"type":"prompt.queued"}'), false);
  assert.equal(isDoneEvent("ikke json"), false);
  assert.equal(isDoneEvent(""), false);
  assert.equal(isDoneEvent("   "), false);
  assert.equal(isDoneEvent('"plugin.agent.signal.done"'), false);
  assert.equal(isDoneEvent("null"), false);
  assert.equal(isDoneEvent("123"), false);
  assert.equal(isDoneEvent("true"), false);
  assert.equal(isDoneEvent('["type","plugin.agent.signal.done"]'), false);
});

function recordingExec(): { exec: ExecFn; calls: { cmd: string; args: string[]; cwd?: string }[] } {
  const calls: { cmd: string; args: string[]; cwd?: string }[] = [];
  const exec: ExecFn = async (cmd, args, opts) => {
    calls.push({ cmd, args, cwd: opts.cwd });
    // `docker inspect` → instansen er ikke oppe.
    if (cmd === "docker" && args[0] === "inspect") return { code: 1, stdout: "", stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  };
  return { exec, calls };
}

test("ensureInstance kjører agent-init og agent-up i nvt-sjekkouten", async () => {
  const { exec, calls } = recordingExec();
  const driver = new DockerNvtDriver({ nvtRoot: "/srv/nvt", agentType: "claude", exec });
  await driver.ensureInstance("topic-1", "fatdev-x-1234abcd");

  const makeCalls = calls.filter((c) => c.cmd === "make");
  assert.deepEqual(makeCalls[0]!.args, [
    "agent-init",
    "NAME=fatdev-x-1234abcd",
    "TYPE=claude",
  ]);
  assert.deepEqual(makeCalls[1]!.args, ["agent-up", "NAME=fatdev-x-1234abcd"]);
  assert.equal(makeCalls[0]!.cwd, "/srv/nvt", "make må kjøres fra NVT_ROOT");
});

test("sendPrompt sender alltid --external (upålitelig input)", async () => {
  const { exec, calls } = recordingExec();
  const driver = new DockerNvtDriver({ nvtRoot: "/srv/nvt", agentType: "claude", exec });
  await driver.sendPrompt({ topic: "t", instance: "fatdev-x-1234abcd" }, "oppgave");

  const call = calls.find((c) => c.args.includes("agentdctl"))!;
  assert.deepEqual(call.args, [
    "exec",
    "agent-fatdev-x-1234abcd-agent-1",
    "agentdctl",
    "prompt",
    "--source",
    "host",
    "--external",
    "oppgave",
  ]);
});

test("prompten sendes som ett argv-element — ingen shell-tolkning", async () => {
  const { exec, calls } = recordingExec();
  const driver = new DockerNvtDriver({ nvtRoot: "/srv/nvt", agentType: "claude", exec });
  const nasty = 'x"; rm -rf / #\n$(whoami) `id` && echo pwned';
  await driver.sendPrompt({ topic: "t", instance: "i" }, nasty);
  const call = calls.find((c) => c.args.includes("agentdctl"))!;
  assert.equal(call.args.at(-1), nasty, "hele prompten er ett argument");
  assert.equal(call.args.filter((a) => a === nasty).length, 1);
});

test("feilende agentdctl kaster (broen skriver da en error-linje)", async () => {
  const exec: ExecFn = async () => ({ code: 3, stdout: "", stderr: "no such container\n" });
  const driver = new DockerNvtDriver({ nvtRoot: "/srv/nvt", agentType: "claude", exec });
  await assert.rejects(
    () => driver.sendPrompt({ topic: "t", instance: "i" }, "x"),
    /agentdctl prompt feilet.*no such container/s,
  );
});

test("feilende make kaster med målet i meldingen", async () => {
  const exec: ExecFn = async (cmd) =>
    cmd === "make"
      ? { code: 2, stdout: "", stderr: "No rule to make target 'agent-init'\n" }
      : { code: 1, stdout: "", stderr: "" };
  const driver = new DockerNvtDriver({ nvtRoot: "/srv/nvt", agentType: "claude", exec });
  await assert.rejects(() => driver.ensureInstance("t", "i"), /make agent-init.*No rule/s);
});

test("stopInstance kjører agent-down (workspacet beholdes)", async () => {
  const { exec, calls } = recordingExec();
  const driver = new DockerNvtDriver({ nvtRoot: "/srv/nvt", agentType: "claude", exec });
  await driver.stopInstance({ topic: "t", instance: "fatdev-x-1234abcd" });
  assert.deepEqual(calls.at(-1)!.args, ["agent-down", "NAME=fatdev-x-1234abcd"]);
});

test("containernavnet følger compose-mønsteret fra planen", () => {
  const driver = new DockerNvtDriver({ nvtRoot: "/srv/nvt", agentType: "claude" });
  assert.equal(driver.containerName("fatdev-x-1234abcd"), "agent-fatdev-x-1234abcd-agent-1");
});

test("en levende instans re-initialiseres ikke", async () => {
  const calls: string[][] = [];
  const exec: ExecFn = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === "docker" && args[0] === "inspect") return { code: 0, stdout: "true\n", stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  };
  const driver = new DockerNvtDriver({ nvtRoot: "/srv/nvt", agentType: "claude", exec });
  await driver.ensureInstance("t", "i");
  assert.equal(calls.some((c) => c[0] === "make"), false, "ingen make når instansen er oppe");
});

import { describe, expect, test } from "bun:test";
import { doctor, launch, type LaunchDeps } from "../src/cli/launch";

const argv = ["--config", "/s/pointer.yaml", "--cortex", "/c", "--log", "/l/threva.log"];

function rig(config: string, over: Partial<LaunchDeps> = {}) {
  const lines: string[] = [];
  const securityCalls: string[][] = [];
  const execCalls: { command: string[]; env: Record<string, string> }[] = [];
  const deps: LaunchDeps = {
    env: { PATH: "/bin" },
    user: "jane",
    now: () => new Date("2026-11-15T10:00:00Z"),
    readConfig: () => config,
    security: (args) => {
      securityCalls.push(args);
      return Promise.resolve({ status: 0, stdout: "sk-secret\n" });
    },
    validate: () => Promise.resolve({ ok: true, output: "" }),
    exec: (command, env) => {
      execCalls.push({ command, env });
      return Promise.resolve(0);
    },
    appendLog: (_path, line) => void lines.push(line),
    ...over,
  };
  return { deps, lines, securityCalls, execCalls };
}

describe("threva launch", () => {
  test("starts Cortex with the Keychain key in its environment", async () => {
    const r = rig("inference:\n  providers:\n    a: {apiKey: env:ANTHROPIC_API_KEY}\n");
    expect(await launch(argv, r.deps)).toBe(0);
    expect(r.securityCalls[0]).toEqual([
      "find-generic-password", "-s", "ai.meta-factory.cortex.cortex.ANTHROPIC_API_KEY", "-a", "jane", "-w",
    ]);
    expect(r.execCalls[0]?.command).toEqual(["bun", "/c/src/cortex.ts", "--config", "/s/pointer.yaml"]);
    expect(r.execCalls[0]?.env.ANTHROPIC_API_KEY).toBe("sk-secret");
    expect(r.lines.join("\n")).not.toContain("sk-secret");
  });

  test("a failed Cortex start is the last recorded error for doctor", async () => {
    const r = rig("x: 1", { exec: () => Promise.resolve(3) });
    expect(await launch(argv, r.deps)).toBe(3);
    expect(r.lines).toHaveLength(2);
    const out = doctor(["--log", "/l"], { readLog: () => r.lines.join("\n") + "\n" });
    expect(out.output).toContain("exited with code 3");
  });

  test("a spawn error is recorded and exits non-zero", async () => {
    const r = rig("x: 1", { exec: () => Promise.reject(new Error("no bun")) });
    expect(await launch(argv, r.deps)).toBe(1);
    expect(r.lines.at(-1)).toContain("could not be started");
  });

  test("runner failures are actionable without logging their secret-bearing errors", async () => {
    for (const runner of ["security", "validate", "exec"] as const) {
      const r = rig("apiKey: env:ANTHROPIC_API_KEY", {
        [runner]: () => Promise.reject(new Error("synthetic-private-value")),
      });
      expect(await launch(argv, r.deps)).toBe(1);
      expect(r.lines.join("\n")).not.toContain("synthetic-private-value");
      expect(doctor(["--log", "/l"], { readLog: () => r.lines.join("\n") }).output).toContain("threva launch:");
    }
  });

  test("an unreadable config is recorded without reflecting the filesystem error", async () => {
    const r = rig("", { readConfig: () => { throw new Error("synthetic-private-value"); } });
    expect(await launch(argv, r.deps)).toBe(1);
    expect(r.execCalls).toHaveLength(0);
    expect(r.securityCalls).toHaveLength(0);
    expect(r.lines.join("\n")).toContain("Check its path and permissions");
    expect(r.lines.join("\n")).not.toContain("synthetic-private-value");
  });

  test("a missing Keychain item records one line and does not start Cortex", async () => {
    const r = rig("apiKey: env:ANTHROPIC_API_KEY", {
      security: () => Promise.resolve({ status: 44, stdout: "" }),
    });
    expect(await launch(argv, r.deps)).toBe(1);
    expect(r.execCalls).toHaveLength(0);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toContain("ANTHROPIC_API_KEY");
    expect(r.lines[0]).toContain("threva setup");
  });

  test("an invalid config records the error and migrate-config", async () => {
    const r = rig("x: 1", { validate: () => Promise.resolve({ ok: false, output: "mc.port\nmust be a number" }) });
    expect(await launch(argv, r.deps)).toBe(1);
    expect(r.execCalls).toHaveLength(0);
    expect(r.lines[0]).toContain("mc.port must be a number");
    expect(r.lines[0]).toContain("migrate-config");
  });

  test("a Claude Code stack reads no Keychain item", async () => {
    const r = rig("claude: {}\n");
    expect(await launch(argv, r.deps)).toBe(0);
    expect(r.securityCalls).toHaveLength(0);
    expect(r.execCalls).toHaveLength(1);
  });
});

describe("threva doctor", () => {
  test("prints the last recorded error", async () => {
    const r = rig("apiKey: env:ANTHROPIC_API_KEY", { security: () => Promise.resolve({ status: 44, stdout: "" }) });
    await launch(argv, r.deps);
    const out = doctor(["--log", "/l"], { readLog: () => `${r.lines.join("\n")}\n` });
    expect(out.output).toBe(r.lines[0]);
  });

  test("says so when nothing is recorded or the last launch started", async () => {
    expect(doctor(["--log", "/l"], { readLog: () => null }).output).toBe("no error recorded");
    const r = rig("claude: {}");
    await launch(argv, r.deps);
    expect(doctor(["--log", "/l"], { readLog: () => `${r.lines.join("\n")}\n` }).output).toBe("no error recorded");
  });
});

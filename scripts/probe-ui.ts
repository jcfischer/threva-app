import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function freePort(): number {
  const server = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() { return; } } });
  const { port } = server;
  server.stop(true);
  return port;
}

const missing = ["CORTEX_DIR", "CORTEX_ADAPTERS_DIR"].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`probe:ui needs ${missing.join(" and ")}; see README.md, "Run it locally".`);
  process.exit(2);
}

const stateDir = mkdtempSync(join(tmpdir(), "threva-probe-"));
const evidence = process.env.THREVA_PROBE_OUT ?? join(stateDir, "evidence");
const timeLimit = process.env.THREVA_PROBE_EXPLORE ?? "2m";
const env = { ...process.env, THREVA_DEV_DIR: stateDir, THREVA_DEV_PORT: String(freePort()) };

const step = (label: string, cmd: string[]): boolean => {
  console.log(`probe:ui ${label}`);
  return Bun.spawnSync(cmd, { env, stdout: "inherit", stderr: "inherit" }).exitCode === 0;
};

const failed: string[] = [];
if (!step("start", ["bun", "run", "dev:stack"])) {
  step("stop", ["bun", "run", "dev:stack", "stop"]);
  console.log("FAILED: dev:stack");
  process.exit(1);
}
try {
  if (!step("journeys", ["bun", "run", "verify:ui", "--out", join(evidence, "journeys")])) failed.push("verify:ui");
  if (!step("explore", ["bun", "run", "explore:ui", "--time-limit", timeLimit, "--out", join(evidence, "explore")])) failed.push("explore:ui");
} finally {
  step("stop", ["bun", "run", "dev:stack", "stop"]);
}
console.log(`probe:ui evidence ${evidence}`);
if (failed.length > 0) {
  console.log(`FAILED: ${failed.join(" · ")}`);
  process.exit(1);
}
console.log("probe:ui passed");

#!/usr/bin/env bun
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { doctor, launch, type LaunchDeps } from "./launch";

function readOrNull(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

async function runCapture(command: string[]): Promise<{ status: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, status] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { status, stdout, stderr };
}

const deps: LaunchDeps = {
  env: process.env,
  user: process.env.USER ?? "",
  now: () => new Date(),
  readConfig: readOrNull,
  security: async (args) => {
    const result = await runCapture(["security", ...args]);
    return { status: result.status, stdout: result.stdout };
  },
  validate: async (cortexDir, pointer) => {
    const result = await runCapture(["bun", `${cortexDir}/src/cortex.ts`, "config", "validate", "--config", pointer]);
    return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
  },
  exec: async (command, env) => {
    const child = Bun.spawn(command, { env, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
      process.on(signal, () => {
        child.kill(signal);
      });
    }
    return child.exited;
  },
  appendLog: (path, line) => {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${line}\n`);
  },
};

const [command, ...rest] = process.argv.slice(2);

if (command === "launch") {
  process.exit(await launch(rest, deps));
} else if (command === "doctor") {
  const result = doctor(rest, { readLog: readOrNull });
  (result.code === 0 ? process.stdout : process.stderr).write(`${result.output}\n`);
  process.exit(result.code);
} else {
  process.stderr.write("Usage: threva <launch|doctor> [options]\n");
  process.exit(2);
}

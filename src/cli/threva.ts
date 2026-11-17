#!/usr/bin/env bun
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { doctor, launch, type LaunchDeps } from "./launch";
import { writeMailConfig } from "./mail-config";
import { ntfy } from "./ntfy";
import { setup, type SetupDeps } from "./setup";
import { errorMessage } from "./text";

function readOrNull(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

async function runCapture(command: string[], env?: Record<string, string | undefined>): Promise<{ status: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(command, { env, stdout: "pipe", stderr: "pipe" });
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
  exec: (command, env) => {
    const executable = Bun.which(command[0] ?? "", { PATH: env.PATH });
    if (!executable || !process.execve) throw new Error("Cortex requires Bun with process.execve support on PATH.");
    process.execve(executable, command, env);
    throw new Error("Cortex process replacement unexpectedly returned.");
  },
  appendLog: (path, line) => {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${line}\n`);
  },
};

let stdinLines: AsyncIterator<string> | null = null;

async function ask(question: string, options?: { secret?: boolean }): Promise<string> {
  stdinLines ??= console[Symbol.asyncIterator]();
  process.stdout.write(question);
  const hide = options?.secret === true && process.stdin.isTTY;
  const restoreEcho = () => {
    Bun.spawnSync(["stty", "echo"], { stdin: "inherit" });
  };
  const abort = () => {
    restoreEcho();
    process.stdout.write("\n");
    process.exit(INTERRUPTED);
  };
  if (hide) {
    Bun.spawnSync(["stty", "-echo"], { stdin: "inherit" });
    process.once("SIGINT", abort);
  }
  try {
    const next = await stdinLines.next();
    if (next.done) throw new Error("Setup needs answers on standard input.");
    return next.value;
  } finally {
    if (hide) {
      process.off("SIGINT", abort);
      restoreEcho();
      process.stdout.write("\n");
    }
  }
}

const INTERRUPTED = 130;

const COMMAND_NOT_RUN = 127;

async function runOrReport(command: string[], env?: Record<string, string | undefined>): Promise<{ status: number; stdout: string; stderr: string }> {
  try {
    return await runCapture(command, env);
  } catch (err) {
    return { status: COMMAND_NOT_RUN, stdout: "", stderr: `${command[0] ?? ""} could not run: ${errorMessage(err)}` };
  }
}

function setupDeps(): SetupDeps {
  return {
    home: process.env.HOME ?? homedir(),
    user: process.env.USER ?? "",
    bunVersion: Bun.version,
    ask,
    say: (line) => {
      process.stdout.write(`${line}\n`);
    },
    which: (command) => Bun.which(command),
    readFile: readOrNull,
    writeFile: (path, text) => {
      writeFileSync(path, text, { mode: 0o600 });
    },
    mkdir: (path) => {
      mkdirSync(path, { recursive: true });
    },
    mailProbe: async (command, text, env) => {
      const dir = mkdtempSync(join(tmpdir(), "threva-imap-"));
      try {
        const config = join(dir, "mail.json");
        writeFileSync(config, text, { mode: 0o600 });
        return await runOrReport(command(config), { ...process.env, ...env });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    writeMailConfig,
    adapter: runOrReport,
    security: (args) => runOrReport(["security", ...args]),
    brew: (args) => runOrReport(["brew", ...args]),
    git: (args, cwd) => runOrReport(["git", "-C", cwd, ...args]),
    validate: (cortexDir, pointer) => runOrReport(["bun", `${cortexDir}/src/cortex.ts`, "config", "validate", "--config", pointer]),
    open: (url) => runOrReport(["open", url]),
    fetch: (url, init) => fetch(url, init),
    sleep: (ms) => Bun.sleep(ms),
  };
}

const [command, ...rest] = process.argv.slice(2);

if (command === "launch") {
  process.exit(await launch(rest, deps));
} else if (command === "doctor") {
  const result = doctor(rest, { readLog: readOrNull });
  (result.code === 0 ? process.stdout : process.stderr).write(`${result.output}\n`);
  process.exit(result.code);
} else if (command === "setup") {
  try {
    process.exit(await setup(rest, setupDeps()));
  } catch (err) {
    process.stderr.write(`${errorMessage(err)}\n`);
    process.exit(1);
  }
} else if (command === "ntfy") {
  const result = await ntfy(rest, { stdin: () => Bun.stdin.text(), fetch: (url, init) => fetch(url, init) });
  if (result.error) process.stderr.write(`${result.error}\n`);
  process.exit(result.code);
} else {
  process.stderr.write("Usage: threva <setup|launch|doctor|ntfy> [options]\n");
  process.exit(2);
}

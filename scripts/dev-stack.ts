import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deskExtras, operatorHome, readOperatorFiles, renderHomeWrapper, wrapperPaths, type DeskExtras, type OperatorFiles } from "./dev-stack-lanes";
import { seedStudio } from "./dev-stack-studio";
import { devEnv, renderCalendar, renderConfig, renderMail, resolvePaths, type DevStackPaths } from "./dev-stack-lib";

const repoDir = resolve(import.meta.dir, "..");
const resolved = resolvePaths(process.env, repoDir, process.execPath, existsSync);
if (!resolved.ok) {
  console.error(resolved.error);
  process.exit(2);
}
const paths = resolved.value;
const configFile = join(paths.stateDir, "config", "threva-dev.yaml");
const pidFile = join(paths.stateDir, "cortex.pid");
const env = devEnv(paths.stateDir, process.env);

function readable(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function operatorExtras(files: OperatorFiles): DeskExtras {
  const wrappers = wrapperPaths(paths.stateDir);
  if (!files.conversations && !files.routing) return deskExtras(files, wrappers, paths.bun, paths.adaptersDir);
  const operator = operatorHome(process.env);
  if (!operator) {
    console.error("Set HOME, so pi and the parser can find the operator's own configuration.");
    process.exit(2);
  }
  const pi = Bun.which("pi") ?? [join(operator.home, ".local", "bin", "pi")].find((p) => existsSync(p));
  if (files.conversations && !pi) {
    console.error("THREVA_DEV_LANES needs pi on PATH or in ~/.local/bin.");
    process.exit(2);
  }
  mkdirSync(join(paths.stateDir, "bin"), { recursive: true });
  if (pi) writeFileSync(wrappers.pi, renderHomeWrapper(operator, pi), { mode: 0o755 });
  writeFileSync(wrappers.withHome, renderHomeWrapper(operator), { mode: 0o755 });
  return deskExtras(files, wrappers, paths.bun, paths.adaptersDir);
}

function cortex(args: string[]) {
  return Bun.spawnSync([paths.bun, "src/cortex.ts", ...args, "--config", configFile], { cwd: paths.cortexDir, env, stdout: "inherit", stderr: "inherit" });
}

function writeStack(p: DevStackPaths, extras: DeskExtras): void {
  for (const dir of ["config", "state", "data", "studio", "sample", "logs", join("home", ".config")]) mkdirSync(join(p.stateDir, dir), { recursive: true });
  writeFileSync(configFile, renderConfig(p, extras), { mode: 0o600 });
  writeFileSync(join(p.stateDir, "config", "assistant.md"), "# Threva dev assistant\n");
  const now = Date.now();
  writeFileSync(join(p.stateDir, "sample", "calendar.ics"), renderCalendar(now));
  writeFileSync(join(p.stateDir, "sample", "mail.json"), renderMail(now));
  const studio = seedStudio(join(p.stateDir, "studio"), now, (args, cwd) => {
    const r = Bun.spawnSync(["git", "-C", cwd, ...args], { env, stdout: "ignore", stderr: "pipe" });
    return { exitCode: r.exitCode, stderr: r.stderr.toString() };
  });
  if (studio.error) {
    console.error(`Could not set up the Studio: ${studio.error}`);
    process.exit(1);
  }
}

async function waitForDesk(port: number, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/desk`)).ok) return true;
    } catch {}
    await Bun.sleep(1000);
  }
  return false;
}

async function start(): Promise<void> {
  if (existsSync(pidFile)) {
    console.error(`A dev stack may already run (pid file ${pidFile}). Run "bun run dev:stack stop" first.`);
    process.exit(1);
  }
  const files = readOperatorFiles(process.env, readable);
  if (!files.ok) {
    console.error(files.error);
    process.exit(2);
  }
  const extras = operatorExtras(files.value);
  writeStack(paths, extras);
  if ((extras.conversations || extras.ask || extras.studioFiler) && cortex(["config", "validate"]).exitCode !== 0) {
    console.error("Cortex refused the generated config; the stack was not started.");
    process.exit(1);
  }
  rmSync(paths.uiDir, { recursive: true, force: true });
  const build = Bun.spawnSync(["bun", "run", "build"], { cwd: repoDir, stdout: "inherit", stderr: "inherit" });
  if (build.exitCode !== 0) process.exit(build.exitCode ?? 1);
  const log = openSync(join(paths.stateDir, "logs", "cortex.log"), "a");
  const child = Bun.spawn([paths.bun, "src/cortex.ts", "start", "--config", configFile], { cwd: paths.cortexDir, env, stdout: log, stderr: log, stdin: "ignore" });
  child.unref();
  writeFileSync(pidFile, String(child.pid));
  if (!(await waitForDesk(paths.port, 60_000))) {
    console.error(`Cortex did not answer within 60 s. See ${join(paths.stateDir, "logs", "cortex.log")}.`);
    process.exit(1);
  }
  console.log(`Threva runs on http://127.0.0.1:${paths.port}/`);
}

function stop(): void {
  if (!existsSync(pidFile)) {
    console.log("No dev stack started by this command is running.");
    return;
  }
  const result = cortex(["stop"]);
  if (result.exitCode === 0) rmSync(pidFile);
  else console.error(`cortex stop failed; pid was ${readFileSync(pidFile, "utf8").trim()}.`);
}

const command = process.argv[2] ?? "start";
if (command === "start") await start();
else if (command === "stop") stop();
else if (command === "status") cortex(["status"]);
else {
  console.error('Usage: bun run dev:stack [start|stop|status]');
  process.exit(2);
}

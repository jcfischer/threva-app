import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { deployConfig, deskApiServes, parseDeskApiVersion, scriptsOf, type DeployConfig, type DeployOutcome } from "./deploy-local-lib";

class DeployError extends Error {}

function run(command: string, args: string[], cwd?: string): string {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) {
    const tail = (result.stderr || result.stdout || "").trim().split("\n").slice(-3).join(" | ");
    throw new DeployError(`${command} ${args.join(" ")} failed: ${tail || `exit ${result.status}`}`);
  }
  return result.stdout.trim();
}

async function readText(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); } catch { return null; }
}

function fetchSource(config: DeployConfig): string {
  if (!existsSync(join(config.sourceDir, ".git"))) {
    run("git", ["clone", "--quiet", config.repoUrl, config.sourceDir]);
  }
  run("git", ["fetch", "--quiet", "origin", "main"], config.sourceDir);
  return run("git", ["rev-parse", "FETCH_HEAD"], config.sourceDir);
}

function build(config: DeployConfig, sha: string): void {
  run("git", ["checkout", "--quiet", "--detach", "--force", sha], config.sourceDir);
  run("git", ["clean", "--quiet", "-fdx", "-e", "node_modules"], config.sourceDir);
  run("bun", ["install", "--frozen-lockfile"], config.sourceDir);
  run("bun", ["run", "build"], config.sourceDir);
}

async function servedDeskApi(config: DeployConfig): Promise<string | null> {
  try {
    const response = await fetch(`${config.cortexUrl}/api/desk/contract`);
    if (!response.ok) return null;
    const body = await response.json() as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

async function served(config: DeployConfig, uiDir: string): Promise<boolean> {
  const index = await readText(join(uiDir, "index.html"));
  if (!index) return false;
  const page = await fetch(`${config.cortexUrl}/`).then(response => response.ok ? response.text() : null).catch(() => null);
  if (page !== index) return false;
  for (const script of scriptsOf(index)) {
    const response = await fetch(`${config.cortexUrl}/${script}`).catch(() => null);
    if (!response?.ok) return false;
  }
  return true;
}

async function swap(config: DeployConfig, built: string, sha: string): Promise<() => Promise<void>> {
  const next = `${config.uiDir}.next`;
  const previous = `${config.uiDir}.prev`;
  await rm(next, { recursive: true, force: true });
  await mkdir(dirname(config.uiDir), { recursive: true });
  await cp(built, next, { recursive: true });
  await writeFile(join(next, "VERSION"), `${sha}\n`);
  await rm(previous, { recursive: true, force: true });
  const hadCurrent = existsSync(config.uiDir);
  if (hadCurrent) await rename(config.uiDir, previous);
  await rename(next, config.uiDir);
  return async () => {
    if (!hadCurrent) return;
    await rm(config.uiDir, { recursive: true, force: true });
    await rename(previous, config.uiDir);
  };
}

async function deploy(config: DeployConfig): Promise<DeployOutcome> {
  let sha: string | null = null;
  try {
    sha = fetchSource(config);
    const recorded = (await readText(join(config.uiDir, "VERSION")))?.trim() ?? "";
    const current = recorded === "" ? null : recorded;
    if (current === sha && !config.force) return { status: "current", sha };
    build(config, sha);
    const needs = parseDeskApiVersion(await readText(join(config.sourceDir, "node_modules/@the-metafactory/cortex/src/desk-api/api-version.ts")) ?? "");
    if (!needs) return { status: "failed", sha, reason: "The build has no Desk API version to check Cortex against." };
    const found = await servedDeskApi(config);
    if (!found || !deskApiServes(found, needs)) {
      return { status: "refused", sha, needs, found, reason: found ? `Cortex serves Desk API ${found}; this build needs ${needs}.` : `Cortex at ${config.cortexUrl} did not report its Desk API version.` };
    }
    const rollback = await swap(config, join(config.sourceDir, "dist/ui"), sha);
    if (!(await served(config, config.uiDir))) {
      await rollback();
      return { status: "failed", sha, reason: `Cortex at ${config.cortexUrl} did not serve the new build; the previous UI is back.` };
    }
    return { status: "deployed", sha, from: current, deskApi: found };
  } catch (error) {
    return { status: "failed", sha, reason: error instanceof Error ? error.message : String(error) };
  }
}

const outcome = await deploy(deployConfig(process.env, process.argv.slice(2)));
console.log(JSON.stringify(outcome));
if (outcome.status === "refused" || outcome.status === "failed") process.exit(1);

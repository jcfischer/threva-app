import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { STAMP, deployConfig, deskApiServes, parseDeskApiVersion, scriptsOf, stampOf, type DeployConfig, type DeployOutcome } from "./deploy-local-lib";

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

async function served(config: DeployConfig, uiDir: string, sha: string): Promise<boolean> {
  const stamp = await fetch(`${config.cortexUrl}/${STAMP}`).then(response => response.ok ? response.text() : null).catch(() => null);
  if (stamp !== stampOf(sha)) return false;
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

interface Swapped {
  replaced: boolean;
  undo: () => Promise<void>;
}

async function swap(config: DeployConfig, built: string, sha: string): Promise<Swapped> {
  const next = `${config.uiDir}.next`;
  const previous = `${config.uiDir}.prev`;
  await rm(next, { recursive: true, force: true });
  await mkdir(dirname(config.uiDir), { recursive: true });
  await cp(built, next, { recursive: true });
  await writeFile(join(next, "VERSION"), `${sha}\n`);
  await writeFile(join(next, STAMP), stampOf(sha));
  await rm(previous, { recursive: true, force: true });
  const replaced = existsSync(config.uiDir);
  if (replaced) await rename(config.uiDir, previous);
  try {
    await rename(next, config.uiDir);
  } catch (error) {
    if (replaced) await rename(previous, config.uiDir);
    throw error;
  }
  return {
    replaced,
    undo: async () => {
      await rm(config.uiDir, { recursive: true, force: true });
      if (replaced) await rename(previous, config.uiDir);
    },
  };
}

async function builtDeskApi(config: DeployConfig): Promise<string | null> {
  const packageDir = join(config.sourceDir, "node_modules/@the-metafactory/cortex");
  const manifest = JSON.parse(await readText(join(packageDir, "package.json")) ?? "{}") as { exports?: Record<string, { types?: unknown } | undefined> };
  const types = manifest.exports?.["./desk-api"]?.types;
  if (typeof types !== "string") return null;
  return parseDeskApiVersion(await readText(join(packageDir, types)) ?? "");
}

function refusal(config: DeployConfig, found: string | null, needs: string): string {
  return found === null ? `Cortex at ${config.cortexUrl} did not report its Desk API version.` : `Cortex serves Desk API ${found}; this build needs ${needs}.`;
}

async function deploy(config: DeployConfig): Promise<DeployOutcome> {
  let sha: string | null = null;
  try {
    sha = fetchSource(config);
    const recorded = (await readText(join(config.uiDir, "VERSION")))?.trim() ?? "";
    const current = recorded === "" ? null : recorded;
    if (current === sha && !config.force) return { status: "current", sha };
    build(config, sha);
    const needs = await builtDeskApi(config);
    if (!needs) return { status: "failed", sha, reason: "The build has no Desk API version to check Cortex against." };
    const found = await servedDeskApi(config);
    if (!found || !deskApiServes(found, needs)) return { status: "refused", sha, needs, found, reason: refusal(config, found, needs) };
    const swapped = await swap(config, join(config.sourceDir, "dist/ui"), sha);
    if (!(await served(config, config.uiDir, sha))) {
      await swapped.undo();
      const after = swapped.replaced ? "the previous UI is back" : "the new UI was removed";
      return { status: "failed", sha, reason: `Cortex at ${config.cortexUrl} did not serve the new build; ${after}.` };
    }
    return { status: "deployed", sha, from: current, deskApi: found };
  } catch (error) {
    return { status: "failed", sha, reason: error instanceof Error ? error.message : String(error) };
  }
}

const outcome = await deploy(deployConfig(process.env, process.argv.slice(2)));
console.log(JSON.stringify(outcome));
if (outcome.status === "refused" || outcome.status === "failed") process.exit(1);

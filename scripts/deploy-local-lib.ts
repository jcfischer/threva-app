import { homedir } from "node:os";
import { join } from "node:path";

export interface DeployConfig {
  sourceDir: string;
  uiDir: string;
  cortexUrl: string;
  repoUrl: string;
  force: boolean;
}

export function deployConfig(env: Readonly<Record<string, string | undefined>>, argv: readonly string[], home: string = homedir()): DeployConfig {
  const share = join(home, ".local", "share", "threva");
  const set = (name: string): string | undefined => env[name] === "" ? undefined : env[name];
  return {
    sourceDir: set("THREVA_DEPLOY_SOURCE") ?? join(share, "src"),
    uiDir: set("THREVA_UI_DIR") ?? join(share, "ui"),
    cortexUrl: (set("THREVA_CORTEX_URL") ?? "http://127.0.0.1:8767").replace(/\/+$/, ""),
    repoUrl: set("THREVA_REPO_URL") ?? "https://github.com/jcfischer/threva-app.git",
    force: argv.includes("--force"),
  };
}

type Version = readonly [major: number, minor: number, patch: number];

function versionOf(text: string): Version | null {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  return parts ? [Number(parts[1]), Number(parts[2]), Number(parts[3])] : null;
}

export function parseDeskApiVersion(source: string): string | null {
  const found = /DESK_API_VERSION\s*=\s*"(\d+\.\d+\.\d+)"/.exec(source);
  return found?.[1] ?? null;
}

export function deskApiServes(found: string, needs: string): boolean {
  const have = versionOf(found);
  const want = versionOf(needs);
  if (have === null || want === null) return false;
  const [haveMajor, haveMinor, havePatch] = have;
  const [wantMajor, wantMinor, wantPatch] = want;
  if (haveMajor !== wantMajor) return false;
  if (haveMinor !== wantMinor) return haveMinor > wantMinor;
  return havePatch >= wantPatch;
}

export function scriptsOf(html: string): string[] {
  return [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].flatMap(match => match[1] ? [match[1].replace(/^\.?\//, "")] : []);
}

export type DeployOutcome =
  | { status: "current"; sha: string }
  | { status: "deployed"; sha: string; from: string | null; deskApi: string }
  | { status: "refused"; sha: string; needs: string; found: string | null; reason: string }
  | { status: "failed"; sha: string | null; reason: string };

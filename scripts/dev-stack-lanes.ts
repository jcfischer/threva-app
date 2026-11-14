import { dirname, join, resolve } from "node:path";
import type { Checked } from "./dev-stack-lib";

export type ParserProvider = "codex" | "pi";

export interface Conversations {
  local?: unknown;
  cloud?: unknown;
  pi?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ParserRouting {
  file: string;
  permitted: ParserProvider[];
  timeoutSeconds: number;
}

export interface OperatorFiles {
  conversations?: Conversations;
  routing?: ParserRouting;
  studioFiler?: StudioFiler;
}

export type StudioFiler = Record<string, unknown> & { local?: Record<string, unknown>; apiKeyFile?: string; caFile?: string };

export interface OperatorHome {
  home: string;
  xdg: Partial<Record<(typeof XDG_VARS)[number], string>>;
}

export const XDG_VARS = ["XDG_CONFIG_HOME", "XDG_STATE_HOME", "XDG_DATA_HOME"] as const;
const PARSER_PROVIDERS: readonly string[] = ["codex", "pi"];
const MAX_ASK_SECONDS = 120;
const PARSER_STARTUP_SECONDS = 5;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const firstLine = (e: unknown): string => (e instanceof Error ? e.message : String(e)).split("\n")[0] ?? "";

type Read = (path: string) => string | null;

function readLanes(file: string, read: Read): Checked<Conversations> {
  const text = read(file);
  if (text === null) return { ok: false, error: `THREVA_DEV_LANES names a file that cannot be read: ${file}` };
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(text);
  } catch (e) {
    return { ok: false, error: `THREVA_DEV_LANES is not valid YAML (${file}): ${firstLine(e)}` };
  }
  if (!isRecord(parsed) || (parsed.local === undefined && parsed.cloud === undefined)) {
    return { ok: false, error: `THREVA_DEV_LANES must hold Cortex's mc.desk.conversations block, with a local or cloud lane: ${file}` };
  }
  if (parsed.pi !== undefined && !isRecord(parsed.pi)) return { ok: false, error: `THREVA_DEV_LANES has a pi entry that is not a mapping: ${file}` };
  return { ok: true, value: parsed as Conversations };
}

function readRouting(file: string, read: Read): Checked<ParserRouting> {
  const text = read(file);
  if (text === null) return { ok: false, error: `THREVA_DEV_PARSER_ROUTING names a file that cannot be read: ${file}` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `THREVA_DEV_PARSER_ROUTING is not valid JSON (${file}): ${firstLine(e)}` };
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.permitted) || typeof parsed.timeoutMs !== "number" || parsed.timeoutMs <= 0) {
    return { ok: false, error: `THREVA_DEV_PARSER_ROUTING must be a desk-parse routing file with version 1, permitted and timeoutMs: ${file}` };
  }
  const permitted = parsed.permitted.filter((p): p is ParserProvider => typeof p === "string" && PARSER_PROVIDERS.includes(p));
  const timeoutSeconds = Math.min(MAX_ASK_SECONDS, Math.ceil(parsed.timeoutMs / 1000) + PARSER_STARTUP_SECONDS);
  return { ok: true, value: { file, permitted, timeoutSeconds } };
}

const isEndpoint = (v: Record<string, unknown>): boolean => typeof v.baseUrl === "string" && typeof v.model === "string";

function withAbsoluteFiles(endpoint: Record<string, unknown>, base: string): Record<string, unknown> {
  const out = { ...endpoint };
  for (const key of ["apiKeyFile", "caFile"]) {
    const value = out[key];
    if (typeof value === "string") out[key] = resolve(base, value);
  }
  return out;
}

function readFiler(file: string, read: Read): Checked<StudioFiler> {
  const text = read(file);
  if (text === null) return { ok: false, error: `THREVA_DEV_STUDIO_FILER names a file that cannot be read: ${file}` };
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(text);
  } catch (e) {
    return { ok: false, error: `THREVA_DEV_STUDIO_FILER is not valid YAML (${file}): ${firstLine(e)}` };
  }
  const local = isRecord(parsed) ? parsed.local : undefined;
  if (!isRecord(parsed) || (local !== undefined && !(isRecord(local) && isEndpoint(local))) || (!isEndpoint(parsed) && local === undefined)) {
    return { ok: false, error: `THREVA_DEV_STUDIO_FILER must hold Cortex's mc.desk.studio.filer block, with baseUrl and model or a local endpoint: ${file}` };
  }
  const base = dirname(file);
  const filer = withAbsoluteFiles(parsed, base);
  if (isRecord(local)) filer.local = withAbsoluteFiles(local, base);
  return { ok: true, value: filer as StudioFiler };
}

export function readOperatorFiles(env: Readonly<Record<string, string | undefined>>, read: Read): Checked<OperatorFiles> {
  const out: OperatorFiles = {};
  if (env.THREVA_DEV_LANES) {
    const lanes = readLanes(resolve(env.THREVA_DEV_LANES), read);
    if (!lanes.ok) return lanes;
    out.conversations = lanes.value;
  }
  if (env.THREVA_DEV_PARSER_ROUTING) {
    const routing = readRouting(resolve(env.THREVA_DEV_PARSER_ROUTING), read);
    if (!routing.ok) return routing;
    out.routing = routing.value;
  }
  if (env.THREVA_DEV_STUDIO_FILER) {
    const filer = readFiler(resolve(env.THREVA_DEV_STUDIO_FILER), read);
    if (!filer.ok) return filer;
    out.studioFiler = filer.value;
  }
  return { ok: true, value: out };
}

export function operatorHome(env: Readonly<Record<string, string | undefined>>): OperatorHome | null {
  if (!env.HOME) return null;
  const xdg: OperatorHome["xdg"] = {};
  for (const name of XDG_VARS) if (env[name]) xdg[name] = env[name];
  return { home: env.HOME, xdg };
}

const sh = (s: string): string => `'${s.replaceAll("'", `'\\''`)}'`;

export function renderHomeWrapper(operator: OperatorHome, command?: string): string {
  return [
    "#!/bin/sh",
    `export HOME=${sh(operator.home)}`,
    ...XDG_VARS.map((name) => (operator.xdg[name] ? `export ${name}=${sh(operator.xdg[name])}` : `unset ${name}`)),
    command ? `exec ${sh(command)} "$@"` : 'exec "$@"',
    "",
  ].join("\n");
}

export interface WrapperPaths {
  pi: string;
  withHome: string;
}

export const wrapperPaths = (stateDir: string): WrapperPaths => ({ pi: join(stateDir, "bin", "pi"), withHome: join(stateDir, "bin", "with-operator-home") });

export interface DeskExtras {
  conversations?: Conversations;
  ask?: { parser: string[]; routing: { permitted: ParserProvider[] }; timeoutSeconds: number };
  studioFiler?: StudioFiler;
}

export function deskExtras(files: OperatorFiles, wrappers: WrapperPaths, bun: string, adaptersDir: string): DeskExtras {
  const extras: DeskExtras = {};
  if (files.conversations) extras.conversations = { ...files.conversations, pi: { ...files.conversations.pi, bin: wrappers.pi } };
  if (files.studioFiler) extras.studioFiler = files.studioFiler;
  if (files.routing) {
    extras.ask = {
      parser: [wrappers.withHome, bun, join(adaptersDir, "bin", "desk-parse.ts"), "--routing-config", files.routing.file],
      routing: { permitted: files.routing.permitted },
      timeoutSeconds: files.routing.timeoutSeconds,
    };
  }
  return extras;
}

export function renderDeskExtras(extras: DeskExtras): string[] {
  return [
    ...(extras.conversations ? [`    conversations: ${JSON.stringify(extras.conversations)}`] : []),
    ...(extras.ask ? [`    ask: ${JSON.stringify(extras.ask)}`] : []),
  ];
}

import { join } from "node:path";
import { KEYCHAIN_SERVICE_PREFIX } from "./launch";

export const STACK_SLUG = "threva";
export const MC_PORT = 8767;
export const uiUrl = (port: number): string => `http://127.0.0.1:${port}/`;
export const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
export const SWITCHED_OFF_BY_DEFAULT = "mail.ranked";
export const NATS_URL = "nats://127.0.0.1:4222";

const API_WAIT_ATTEMPTS = 30;
const API_WAIT_MS = 1000;

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface SetupDeps {
  home: string;
  user: string;
  bunVersion: string;
  ask: (question: string, options?: { secret?: boolean }) => Promise<string>;
  say: (line: string) => void;
  which: (command: string) => string | null;
  readFile: (path: string) => string | null;
  writeFile: (path: string, text: string) => void;
  mkdir: (path: string) => void;
  security: (args: string[]) => Promise<RunResult>;
  brew: (args: string[]) => Promise<RunResult>;
  git: (args: string[], cwd: string) => Promise<RunResult>;
  validate: (cortexDir: string, pointer: string) => Promise<RunResult>;
  open: (url: string) => Promise<RunResult>;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
}

export type Provider =
  | { kind: "anthropic"; keyName: "ANTHROPIC_API_KEY" }
  | { kind: "openai-compatible"; keyName: "OPENAI_API_KEY"; baseUrl: string }
  | { kind: "claude-code" };

export interface StackPlan {
  principal: string;
  uiDir: string;
  studioDir: string;
  provider: Provider;
  ntfyUrl: string | null;
  threvaBin: string;
  port: number;
}

export interface SetupArgs {
  reconfigure: boolean;
  cortex: string | null;
  ui: string | null;
  port: number;
}

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const SETUP_USAGE = "Usage: threva setup [--reconfigure] [--cortex <dir>] [--ui <dir>] [--port <port>]";

export function parseSetupArgs(argv: readonly string[]): Checked<SetupArgs> {
  const args: SetupArgs = { reconfigure: false, cortex: null, ui: null, port: MC_PORT };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    const value = argv[i + 1];
    if (name === "--reconfigure") {
      args.reconfigure = true;
    } else if ((name === "--cortex" || name === "--ui") && value && !value.startsWith("--")) {
      args[name === "--cortex" ? "cortex" : "ui"] = value;
      i++;
    } else if (name === "--port" && value && /^\d+$/.test(value) && Number(value) >= 1024 && Number(value) <= 65535) {
      args.port = Number(value);
      i++;
    } else {
      return { ok: false, error: SETUP_USAGE };
    }
  }
  return { ok: true, value: args };
}

export function stackPaths(home: string): { dir: string; pointer: string } {
  const dir = join(home, ".config", "metafactory", "cortex", STACK_SLUG);
  return { dir, pointer: join(dir, `${STACK_SLUG}.yaml`) };
}

export function principalId(user: string): string {
  const slug = user.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug === "" ? "threva" : slug;
}

export function bunMeetsEngines(cortexPackageJson: string | null, bunVersion: string): Checked<string> {
  let range: unknown;
  try {
    range = cortexPackageJson === null ? undefined : (JSON.parse(cortexPackageJson) as { engines?: { bun?: unknown } }).engines?.bun;
  } catch {
    range = undefined;
  }
  if (typeof range !== "string" || range.trim() === "") {
    return { ok: false, error: "The installed Cortex does not say which Bun it needs (engines.bun in its package.json). Reinstall Threva with brew reinstall threva." };
  }
  if (!Bun.semver.satisfies(bunVersion, range)) {
    return { ok: false, error: `Cortex needs Bun ${range}, and this Bun is ${bunVersion}. Run brew upgrade bun, then run threva setup again.` };
  }
  return { ok: true, value: range };
}

export function isEndpointUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  } catch {
    return false;
  }
}

export function isNtfyTopicUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && /^\/[A-Za-z0-9_-]+$/.test(url.pathname);
  } catch {
    return false;
  }
}

function inferenceBlock(provider: Provider): Record<string, unknown> {
  if (provider.kind === "anthropic") {
    return { providers: { anthropic: { protocol: "anthropic-messages", baseUrl: ANTHROPIC_BASE_URL, apiKey: `env:${provider.keyName}` } } };
  }
  if (provider.kind === "openai-compatible") {
    return { providers: { "openai-compatible": { protocol: "openai-chat-completions", baseUrl: provider.baseUrl, apiKey: `env:${provider.keyName}` } } };
  }
  return {};
}

export function renderSystem(plan: StackPlan): string {
  const inference = inferenceBlock(plan.provider);
  const system = {
    claude: {},
    nats: { url: NATS_URL, name: STACK_SLUG },
    ...(Object.keys(inference).length > 0 ? { inference } : {}),
  };
  return `${JSON.stringify(system, null, 2)}\n`;
}

export function renderStack(plan: StackPlan): string {
  const interruptions = plan.ntfyUrl
    ? { transport: "command", command: [plan.threvaBin, "ntfy", plan.ntfyUrl], notifications: true }
    : { transport: "none", notifications: true };
  const stack = {
    principal: { id: plan.principal },
    stack: { id: `${plan.principal}/${STACK_SLUG}` },
    agents: [{ id: "assistant", displayName: "Threva", persona: "./assistant.md", presence: {} }],
    mc: {
      enabled: true,
      port: plan.port,
      ui: { dir: plan.uiDir },
      desk: {
        enabled: true,
        studio: { dir: plan.studioDir },
        mail: { rules: { proposeAfter: 3 } },
        interruptions,
      },
    },
  };
  return `${JSON.stringify(stack, null, 2)}\n`;
}

export const POINTER_TEXT = "# Threva stack: Cortex reads system/ and stacks/ beside this file.\n";
export const PERSONA_TEXT = "# Threva\n\nYou are the assistant inside Threva, a local workspace.\n";

async function choose(deps: SetupDeps, claudeOnPath: boolean): Promise<Provider["kind"]> {
  const options: { kind: Provider["kind"]; label: string }[] = [
    { kind: "anthropic", label: "An Anthropic API key" },
    { kind: "openai-compatible", label: "An OpenAI-compatible endpoint (base URL and key)" },
    ...(claudeOnPath ? [{ kind: "claude-code" as const, label: "Your Claude Code login" }] : []),
  ];
  deps.say("Which model should Threva use?");
  for (const [i, option] of options.entries()) deps.say(`  ${i + 1}. ${option.label}`);
  for (;;) {
    const answer = (await deps.ask(`Choose 1-${options.length}: `)).trim();
    const number = Number(answer);
    if (/^\d+$/.test(answer) && number >= 1 && number <= options.length) return options[number - 1].kind;
    deps.say(`Type a number from 1 to ${options.length}.`);
  }
}

async function askUntil(deps: SetupDeps, question: string, valid: (answer: string) => boolean, hint: string, secret = false): Promise<string> {
  for (;;) {
    const answer = (await deps.ask(question, { secret })).trim();
    if (valid(answer)) return answer;
    deps.say(hint);
  }
}

const isKey = (answer: string): boolean => answer !== "" && !/\s/.test(answer);

async function askProvider(deps: SetupDeps, claudeOnPath: boolean): Promise<{ provider: Provider; key: string | null }> {
  const kind = await choose(deps, claudeOnPath);
  if (kind === "claude-code") return { provider: { kind }, key: null };
  if (kind === "anthropic") {
    const key = await askUntil(deps, "Anthropic API key: ", isKey, "Paste the key on one line.", true);
    return { provider: { kind, keyName: "ANTHROPIC_API_KEY" }, key };
  }
  const baseUrl = await askUntil(deps, "Base URL (for example https://api.example.com/v1): ", isEndpointUrl, "Give an https URL, or http on 127.0.0.1 or localhost.");
  const key = await askUntil(deps, "API key: ", isKey, "Paste the key on one line.", true);
  return { provider: { kind, keyName: "OPENAI_API_KEY", baseUrl: baseUrl.replace(/\/+$/, "") }, key };
}

async function askPush(deps: SetupDeps): Promise<string | null> {
  deps.say("Threva can send interruptions to your phone with ntfy (https://ntfy.sh).");
  const answer = await askUntil(
    deps,
    "ntfy topic URL, for example https://ntfy.sh/your-topic (leave empty to skip): ",
    (a) => a === "" || isNtfyTopicUrl(a),
    "Give an https URL that ends in the topic name, or leave it empty.",
  );
  return answer === "" ? null : answer;
}

const PORT_FREE = false;

async function answersOn(deps: SetupDeps, port: number): Promise<boolean> {
  try {
    await deps.fetch(uiUrl(port));
    return true;
  } catch {
    return PORT_FREE;
  }
}

async function waitForApi(deps: SetupDeps, port: number): Promise<boolean> {
  for (let attempt = 0; attempt < API_WAIT_ATTEMPTS; attempt++) {
    try {
      const response = await deps.fetch(`${uiUrl(port)}api/desk/interruptions`);
      if (response.ok) return true;
    } catch (err) {
      if (attempt === API_WAIT_ATTEMPTS - 1) deps.say(`Threva did not answer: ${err instanceof Error ? err.message : String(err)}`);
    }
    await deps.sleep(API_WAIT_MS);
  }
  return false;
}

async function switchOffRankedMail(deps: SetupDeps, port: number): Promise<boolean> {
  try {
    const response = await deps.fetch(`${uiUrl(port)}api/desk/interruptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: SWITCHED_OFF_BY_DEFAULT, on: false }),
    });
    return response.ok;
  } catch (err) {
    deps.say(`Threva did not take the interruption setting: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function firstLine(result: RunResult): string {
  return (result.stderr || result.stdout).trim().split("\n")[0] ?? "";
}

async function resolveInstall(args: SetupArgs, deps: SetupDeps): Promise<Checked<{ cortexDir: string; uiDir: string; prefix: string }>> {
  const prefixRun = await deps.brew(["--prefix"]);
  const prefix = prefixRun.stdout.trim();
  if (prefixRun.status !== 0 || prefix === "") return { ok: false, error: "Homebrew did not answer brew --prefix. Check that Homebrew is installed." };
  const libexec = join(prefix, "opt", "threva", "libexec");
  const cortexDir = args.cortex ?? join(libexec, "cortex");
  const uiDir = args.ui ?? join(libexec, "ui");
  if (deps.readFile(join(cortexDir, "src", "cortex.ts")) === null) return { ok: false, error: `No Cortex at ${cortexDir}. Reinstall with brew reinstall threva, or pass --cortex <dir>.` };
  if (deps.readFile(join(uiDir, "index.html")) === null) return { ok: false, error: `No Threva UI at ${uiDir}. Reinstall with brew reinstall threva, or pass --ui <dir>.` };
  return { ok: true, value: { cortexDir, uiDir, prefix } };
}

export async function setup(argv: readonly string[], deps: SetupDeps): Promise<number> {
  const parsed = parseSetupArgs(argv);
  if (!parsed.ok) {
    deps.say(parsed.error);
    return 2;
  }
  const install = await resolveInstall(parsed.value, deps);
  if (!install.ok) {
    deps.say(install.error);
    return 1;
  }
  const { cortexDir, uiDir, prefix } = install.value;

  const engines = bunMeetsEngines(deps.readFile(join(cortexDir, "package.json")), deps.bunVersion);
  if (!engines.ok) {
    deps.say(engines.error);
    return 1;
  }

  const paths = stackPaths(deps.home);
  const existed = deps.readFile(paths.pointer) !== null;
  if (existed && !parsed.value.reconfigure) {
    deps.say(`A Threva stack already exists at ${paths.dir}. Setup changed nothing. Run threva setup --reconfigure to set it up again.`);
    return 0;
  }
  const { port } = parsed.value;
  if (!existed && (await answersOn(deps, port))) {
    deps.say(`Another program already answers on port ${port}, perhaps another Cortex. Stop it, or run threva setup --port <port> with a free port.`);
    return 1;
  }

  const { provider, key } = await askProvider(deps, deps.which("claude") !== null);
  const ntfyUrl = await askPush(deps);

  if (key !== null && provider.kind !== "claude-code") {
    const stored = await deps.security(["add-generic-password", "-U", "-s", `${KEYCHAIN_SERVICE_PREFIX}${provider.keyName}`, "-a", deps.user, "-w", key]);
    if (stored.status !== 0) {
      deps.say(`The key could not be stored in the Keychain: ${firstLine(stored)}. Setup changed nothing.`);
      return 1;
    }
    deps.say(`Stored the key in the Keychain as ${KEYCHAIN_SERVICE_PREFIX}${provider.keyName}.`);
  }

  const studioDir = join(deps.home, ".local", "share", STACK_SLUG, "studio");
  const plan: StackPlan = { principal: principalId(deps.user), uiDir, studioDir, provider, ntfyUrl, threvaBin: join(prefix, "bin", "threva"), port };
  for (const dir of [join(paths.dir, "system"), join(paths.dir, "stacks"), studioDir]) deps.mkdir(dir);
  deps.writeFile(paths.pointer, POINTER_TEXT);
  deps.writeFile(join(paths.dir, "system", "system.yaml"), renderSystem(plan));
  deps.writeFile(join(paths.dir, "stacks", `${STACK_SLUG}.yaml`), renderStack(plan));
  deps.writeFile(join(paths.dir, "assistant.md"), PERSONA_TEXT);
  const gitInit = await deps.git(["init", "-q"], studioDir);
  if (gitInit.status !== 0) {
    deps.say(`git init failed in ${studioDir}: ${firstLine(gitInit)}`);
    return 1;
  }
  deps.say(`Wrote the stack to ${paths.dir}.`);

  const validation = await deps.validate(cortexDir, paths.pointer);
  if (validation.status !== 0) {
    deps.say(`Cortex refused the stack config: ${firstLine(validation)}`);
    return 1;
  }

  const services: [string, string][] = [["start", "nats-server"], [existed ? "restart" : "start", "threva"]];
  for (const [verb, service] of services) {
    const started = await deps.brew(["services", verb, service]);
    if (started.status !== 0) {
      deps.say(`brew services could not ${verb} ${service}: ${firstLine(started)}`);
      return 1;
    }
  }

  if (!(await waitForApi(deps, port))) {
    deps.say(`Threva did not start. Run threva doctor --log ${join(prefix, "var", "log", "threva.log")} to see why.`);
    return 1;
  }
  if (!existed && !(await switchOffRankedMail(deps, port))) {
    deps.say("Other mail ranked for today still interrupts you. Switch it off under Interruptions.");
  }

  const url = uiUrl(port);
  const opened = await deps.open(url);
  if (opened.status !== 0) deps.say(`Open ${url} in your browser.`);
  deps.say(`Threva is running at ${url}`);
  return 0;
}

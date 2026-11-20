export const KEYCHAIN_SERVICE_PREFIX = "ai.meta-factory.cortex.cortex.";
export const NO_ERROR_RECORDED = "no error recorded";

const LAUNCH_TAG = "threva launch";
const OK_MARK = "started";

export interface SecurityResult {
  status: number;
  stdout: string;
}

export interface ValidationResult {
  ok: boolean;
  output: string;
}

export interface LaunchDeps {
  env: Readonly<Record<string, string | undefined>>;
  user: string;
  now: () => Date;
  readConfig: (path: string) => string | null;
  security: (args: string[]) => Promise<SecurityResult>;
  validate: (cortexDir: string, pointer: string) => Promise<ValidationResult>;
  exec: (command: string[], env: Record<string, string>) => void;
  appendLog: (path: string, line: string) => void;
}

export interface DoctorDeps {
  readLog: (path: string) => string | null;
}

export interface LaunchArgs {
  config: string;
  cortex: string;
  log: string;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function flags(argv: readonly string[]): Map<string, string> {
  const found = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i] ?? "";
    const value = argv[i + 1] ?? "--";
    if (name.startsWith("--") && !value.startsWith("--")) {
      found.set(name, value);
      i++;
    }
  }
  return found;
}

export function parseLaunchArgs(argv: readonly string[]): Parsed<LaunchArgs> {
  const found = flags(argv);
  const config = found.get("--config");
  const cortex = found.get("--cortex");
  const log = found.get("--log");
  if (!config || !cortex || !log) {
    return { ok: false, error: "Usage: threva launch --config <pointer> --cortex <dir> --log <path>" };
  }
  return { ok: true, value: { config, cortex, log } };
}

export function envKeysReferenced(configText: string): string[] {
  const names = new Set<string>();
  for (const match of configText.matchAll(/\benv:([A-Z][A-Z0-9_]*)/g)) {
    if (match[1]) names.add(match[1]);
  }
  return [...names];
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function record(deps: LaunchDeps, log: string, message: string): void {
  deps.appendLog(log, `${deps.now().toISOString()} ${LAUNCH_TAG}: ${oneLine(message)}`);
}

async function keychainSecrets(keys: readonly string[], deps: LaunchDeps): Promise<Parsed<Record<string, string>>> {
  const secrets: Record<string, string> = {};
  for (const key of keys) {
    if (deps.env[key]) continue;
    let found: SecurityResult;
    try {
      found = await deps.security(["find-generic-password", "-s", `${KEYCHAIN_SERVICE_PREFIX}${key}`, "-a", deps.user, "-w"]);
    } catch {
      return { ok: false, error: `The key ${key} could not be read from the Keychain. Check macOS Keychain access, then run threva setup.` };
    }
    const value = found.stdout.replace(/\r?\n$/, "");
    if (found.status !== 0 || value === "") {
      return { ok: false, error: `The key ${key} is not in the Keychain. Run threva setup to add it.` };
    }
    secrets[key] = value;
  }
  return { ok: true, value: secrets };
}

export async function launch(argv: readonly string[], deps: LaunchDeps): Promise<number> {
  const parsed = parseLaunchArgs(argv);
  if (!parsed.ok) {
    process.stderr.write(`${parsed.error}\n`);
    return 2;
  }
  const { config, cortex, log } = parsed.value;
  let configText: string | null;
  try {
    configText = deps.readConfig(config);
  } catch {
    record(deps, log, `Cannot read the stack config at ${config}. Check its path and permissions.`);
    return 1;
  }
  if (configText === null) {
    record(deps, log, `Cannot read the stack config at ${config}.`);
    return 1;
  }

  let validation: ValidationResult;
  try {
    validation = await deps.validate(cortex, config);
  } catch {
    record(deps, log, "Cortex config validation could not run. Check the Bun executable and --cortex directory, then run threva doctor.");
    return 1;
  }
  if (!validation.ok) {
    record(
      deps,
      log,
      `The stack config is invalid: ${validation.output} Run bun ${cortex}/src/cortex.ts migrate-config to update it.`,
    );
    return 1;
  }

  const secrets = await keychainSecrets(envKeysReferenced(configText), deps);
  if (!secrets.ok) {
    record(deps, log, secrets.error);
    return 1;
  }

  const childEnv: Record<string, string> = {};
  for (const [name, value] of Object.entries(deps.env)) {
    if (value !== undefined) childEnv[name] = value;
  }
  Object.assign(childEnv, secrets.value);

  record(deps, log, OK_MARK);
  try {
    deps.exec(["bun", `${cortex}/src/cortex.ts`, "start", "--config", config], childEnv);
  } catch {
    record(deps, log, "Cortex could not be started. Check the Bun executable and --cortex directory.");
    return 1;
  }
  return 0;
}

export function lastLauncherError(logText: string | null): string {
  if (logText === null) return NO_ERROR_RECORDED;
  const marker = ` ${LAUNCH_TAG}: `;
  const lines = logText.split("\n").filter((line) => line.includes(marker));
  const last = lines.at(-1);
  if (last === undefined || last.endsWith(`${marker}${OK_MARK}`)) return NO_ERROR_RECORDED;
  return last;
}

export function doctor(argv: readonly string[], deps: DoctorDeps): { code: number; output: string } {
  const log = flags(argv).get("--log");
  if (!log) return { code: 2, output: "Usage: threva doctor --log <path>" };
  return { code: 0, output: lastLauncherError(deps.readLog(log)) };
}

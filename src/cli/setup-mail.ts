import { join } from "node:path";
import { mailKeychainInput, mailKeychainRestore } from "./mail-keychain";
import { COMMAND_NOT_RUN } from "./run";
import { askUntil } from "./setup-prompts";
import type { SetupDeps } from "./setup";

const PROBE_PASSWORD_ENV = "THREVA_SETUP_IMAP_PASSWORD";
const KEYCHAIN_ITEM_MISSING = 44;
const SERVICE_PREFIX = "threva-mail-";
const ACCOUNT_PROMPT = "Mail account name (leave empty to keep current accounts or skip mail): ";
const ACCOUNT_NAME = /^[a-z][a-z0-9-]{0,31}$/;
const HOST_NAME = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADAPTERS = ["desk-imap", "desk-mail-move", "desk-mail-trash", "desk-mail-draft", "desk-mail-invite", "desk-mail-report"] as const;

type MailDeps = Pick<SetupDeps, "ask" | "say" | "which" | "readFile" | "security" | "mailProbe" | "storeMailPassword" | "writeMailConfig">;
type Adapter = typeof ADAPTERS[number];
interface MailSource {
  id: string;
  command: string[];
  everySeconds: number;
  timeoutSeconds: number;
}
export interface MailPlan {
  sources: MailSource[];
  actions?: { move: string[]; trash: string[]; draft: string[] };
  invitations?: { command: string[] };
  report?: { command: string[]; to: string };
}
type MailSetup = { ok: true; plan: MailPlan } | { ok: false };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
type MailConfig = Record<string, unknown> & { accounts: Record<string, unknown> };

function readAccounts(text: string | null): MailConfig {
  if (text === null) return { accounts: {} };
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || !isRecord(value.accounts)) throw new Error("Invalid account file");
  return { ...value, accounts: value.accounts };
}

function mailPlan(config: MailConfig, command: (adapter: Adapter) => string[]): MailPlan {
  const sources = Object.entries(config.accounts).flatMap(([name, value]) => {
    if (!ACCOUNT_NAME.test(name) || !isRecord(value) || !isRecord(value.imap) || value.imap.enabled !== true) return [];
    return [{
      id: `mail-${name}`, command: [...command("desk-imap"), "--account", name, "--sent"], everySeconds: 300, timeoutSeconds: 60,
    }];
  });
  if (!sources.length) return { sources };
  return {
    sources,
    actions: { move: command("desk-mail-move"), trash: command("desk-mail-trash"), draft: command("desk-mail-draft") },
    invitations: { command: command("desk-mail-invite") },
    ...(typeof config.phishingReportTo === "string" && EMAIL.test(config.phishingReportTo)
      ? { report: { command: command("desk-mail-report"), to: config.phishingReportTo } }
      : {}),
  };
}

async function port(deps: MailDeps, label: string, fallback: number): Promise<number> {
  const value = await askUntil(deps, `${label} port (leave empty for ${fallback}): `,
    answer => answer === "" || (/^\d+$/.test(answer) && +answer >= 1 && +answer <= 65535), "Enter a port from 1 to 65535.");
  return value ? Number(value) : fallback;
}

function safeDiagnostic(stderr: string, password: string): string {
  let line = stderr.trim().split(/\r?\n/).at(-1) ?? "";
  const encoded = Buffer.from(password);
  for (const value of [encodeURIComponent(password), encoded.toString("base64"), encoded.toString("hex"), password]) {
    line = line.replaceAll(value, "[redacted]");
  }
  return line.replace(/\p{C}/gu, " ").slice(0, 300);
}

interface AccountWrite {
  config: string;
  name: string;
  service: string;
  password: string;
  next: MailConfig;
}

async function saveAccount(deps: MailDeps, { config, name, service, password, next }: AccountWrite): Promise<boolean> {
  const lookup = await deps.security(["find-generic-password", "-s", service, "-a", name, "-g"]);
  const updates = lookup.status === 0;
  const rollback = updates ? mailKeychainRestore(service, name, lookup.stderr) : null;
  if ((updates && !rollback) || (!updates && lookup.status !== KEYCHAIN_ITEM_MISSING)) {
    deps.say("The existing mail password could not be read for replacement. The mail account was left unchanged.");
    return false;
  }
  const input = mailKeychainInput(service, name, password, updates);
  if (!input || !await deps.storeMailPassword(input)) {
    deps.say("The mail password could not be stored in the Keychain. The mail account was left unchanged.");
    return false;
  }
  try {
    deps.writeMailConfig(config, `${JSON.stringify(next, null, 2)}\n`);
  } catch {
    const restored = rollback
      ? await deps.storeMailPassword(rollback)
      : (await deps.security(["delete-generic-password", "-s", service, "-a", name])).status === 0;
    deps.say(restored
      ? `The mail config at ${config} could not be written. Setup left it unchanged.`
      : `The mail config at ${config} could not be written and the Keychain change could not be undone.`);
    return false;
  }
  return true;
}

async function askAccountSettings(deps: MailDeps) {
  const address = await askUntil(deps, "Mail address: ", value => EMAIL.test(value), "Enter one email address.");
  const imapHost = await askUntil(deps, "IMAP hostname (TLS required): ", value => HOST_NAME.test(value), "Enter the server hostname.");
  const imapPort = await port(deps, "IMAP TLS", 993);
  const smtpHost = await askUntil(deps, "SMTP hostname: ", value => HOST_NAME.test(value), "Enter the server hostname.");
  const smtpTls = await askUntil(deps, "SMTP encryption: 1 for STARTTLS (default), 2 for implicit TLS: ", value => ["", "1", "2"].includes(value), "Choose 1 or 2.");
  const secure = smtpTls === "2";
  const smtpPort = await port(deps, "SMTP", secure ? 465 : 587);
  const login = await askUntil(deps, "Mail server login (leave empty to use your address): ", value => !/[\r\n\0]/.test(value), "Enter the login on one line.") || address;
  const reportTo = await askUntil(deps, "Phishing report address (leave empty to keep the current address or skip, type - to remove): ",
    value => value === "" || value === "-" || EMAIL.test(value), "Enter one email address, leave it empty, or type - to remove it.");

  const account = (pass: string) => {
    const auth = { user: login, pass };
    return {
      from: { email: address },
      imap: { enabled: true, host: imapHost, port: imapPort, tls: true, auth },
      smtp: { host: smtpHost, port: smtpPort, secure, auth },
    };
  };
  return { account, reportTo };
}

export async function setupMail(libexec: string, home: string, deps: MailDeps): Promise<MailSetup> {
  const bin = join(libexec, "adapters", "bin");
  const bun = deps.which("bun");
  const config = join(home, ".config", "threva", "mail-accounts.json");
  let existing: MailConfig;
  try {
    existing = readAccounts(deps.readFile(config));
  } catch {
    deps.say(`The mail config at ${config} could not be read. Setup left it unchanged.`);
    return { ok: false };
  }
  if (!bun || ADAPTERS.some(adapter => deps.readFile(join(bin, `${adapter}.ts`)) === null)) {
    if (Object.keys(existing.accounts).length) {
      deps.say("Reinstall Threva to restore the mail adapters. Setup kept the configured mail accounts.");
      return { ok: false };
    }
    deps.say("The installed bundle has no complete set of mail adapters. Skipping mail setup.");
    return { ok: true, plan: { sources: [] } };
  }
  const command = (adapter: Adapter, path = config) => [bun, join(bin, `${adapter}.ts`), "--config", path];
  const retained: MailSetup = { ok: true, plan: mailPlan(existing, command) };
  const name = await askUntil(deps, ACCOUNT_PROMPT, value => value === "" || ACCOUNT_NAME.test(value), "Use a lowercase name such as personal or work-mail.");
  if (!name) return retained;

  const { account, reportTo } = await askAccountSettings(deps);
  const probe = JSON.stringify({ accounts: { [name]: account(`env:${PROBE_PASSWORD_ENV}`) } });
  const service = `${SERVICE_PREFIX}${name}`;
  for (;;) {
    const password = await deps.ask("Mail password (leave empty to keep current accounts or skip mail): ", { secret: true });
    if (!password) return retained;
    if (!/^[ -~]+$/.test(password) || password.trim() !== password || !mailKeychainInput(service, name, password, true)) {
      deps.say("Enter a shorter password using ASCII characters without leading or trailing whitespace, or leave it empty to skip.");
      continue;
    }
    const attempt = await deps.mailProbe(path => [...command("desk-imap", path), "--account", name, "--limit", "1"], probe, { [PROBE_PASSWORD_ENV]: password });
    if (attempt.status === COMMAND_NOT_RUN) {
      deps.say("The IMAP adapter could not run. Reinstall Threva and try setup again.");
      return { ok: false };
    }
    if (attempt.status !== 0) {
      const detail = safeDiagnostic(attempt.stderr, password);
      deps.say(`IMAP login failed or the inbox could not be read.${detail ? ` ${detail}` : ""} Try another password, or leave it empty to continue and correct the server settings with threva setup --reconfigure.`);
      continue;
    }
    const next = {
      ...existing,
      defaultAccount: existing.defaultAccount ?? name,
      phishingReportTo: reportTo === "-" ? undefined : reportTo || existing.phishingReportTo,
      accounts: { ...existing.accounts, [name]: account(`keychain:${service}`) },
    };
    if (!await saveAccount(deps, { config, name, service, password, next })) return { ok: false };
    return { ok: true, plan: mailPlan(next, command) };
  }
}

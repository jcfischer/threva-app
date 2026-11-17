import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { askUntil } from "./setup-prompts";
import type { SetupDeps } from "./setup";

const ACCOUNT = "personal";
const PROBE_PASSWORD_ENV = "THREVA_SETUP_IMAP_PASSWORD";
const SERVICE_PREFIX = "ai.meta-factory.threva.imap.";
const COMMAND_NOT_RUN = 127;
const ACCOUNT_PROMPT = "IMAP login (leave empty to keep the current account or skip mail): ";

type MailDeps = Pick<SetupDeps, "ask" | "say" | "which" | "readFile" | "security" | "mailProbe" | "writeMailConfig">;
interface Source { id: string; command: string[] }
type MailSetup = { ok: true; source?: Source } | { ok: false };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

type MailConfig = Record<string, unknown> & { accounts: Record<string, unknown> };

function readAccounts(text: string | null): MailConfig {
  if (text === null) return { accounts: {} };
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || !isRecord(value.accounts)) throw new Error("Invalid account file");
  return { ...value, accounts: value.accounts };
}

export async function setupMail(libexec: string, dir: string, deps: MailDeps): Promise<MailSetup> {
  const adapter = join(libexec, "adapters", "bin", "desk-imap.ts");
  const bun = deps.which("bun");
  const config = join(dir, "mail.json");
  let existing: MailConfig;
  try {
    existing = readAccounts(deps.readFile(config));
  } catch {
    deps.say(`The mail config at ${config} could not be read. Setup left it unchanged.`);
    return { ok: false };
  }
  const { accounts } = existing;
  const primary = isRecord(accounts[ACCOUNT]) ? accounts[ACCOUNT] : null;
  if (deps.readFile(adapter) === null || !bun) {
    if (primary) {
      deps.say("Reinstall Threva to restore the IMAP adapter. Setup kept the configured mail account.");
      return { ok: false };
    }
    deps.say("The installed bundle has no IMAP adapter. Skipping mail setup.");
    return { ok: true };
  }

  const command = (path: string) => [bun, adapter, "--config", path, "--account", ACCOUNT];
  const source = { id: "mail", command: command(config) };
  const retained: MailSetup = primary ? { ok: true, source } : { ok: true };
  const login = (await deps.ask(ACCOUNT_PROMPT)).trim();
  if (!login) return retained;

  const host = await askUntil(deps, "IMAP server (for example imap.example.com): ", value => /^[a-z0-9.-]+$/i.test(value) && /[a-z0-9]/i.test(value), "Enter the server hostname.");
  const port = Number((await askUntil(deps, "IMAP TLS port (leave empty for 993): ", value => value === "" || (/^\d+$/.test(value) && +value >= 1 && +value <= 65535), "Enter a port from 1 to 65535.")) || "993");

  const account = (password: string) => ({
    imap: { enabled: true, host, port, tls: true, auth: { user: login, pass: password } },
  });
  const probe = JSON.stringify({ accounts: { [ACCOUNT]: account(`env:${PROBE_PASSWORD_ENV}`) } });
  for (;;) {
    const password = await deps.ask("IMAP password (leave empty to keep the current account or skip mail): ", { secret: true });
    if (!password) return retained;
    const attempt = await deps.mailProbe(path => [...command(path), "--limit", "1"], probe, { [PROBE_PASSWORD_ENV]: password });
    if (attempt.status === COMMAND_NOT_RUN) {
      deps.say("The IMAP adapter could not run. Reinstall Threva and try setup again.");
      return { ok: false };
    }
    if (attempt.status !== 0) {
      deps.say("IMAP login failed or the inbox could not be read. Try another password, or leave it empty to continue and correct the server settings with threva setup --reconfigure.");
      continue;
    }

    const service = `${SERVICE_PREFIX}${randomUUID()}`;
    const stored = await deps.security(["add-generic-password", "-s", service, "-a", login, "-w", password]);
    if (stored.status !== 0) {
      deps.say("The IMAP password could not be stored in the Keychain. The mail config was left unchanged.");
      return { ok: false };
    }
    const previousImap = primary?.imap;
    const previousAuth = isRecord(previousImap) ? previousImap.auth : null;
    const retainedSettings = isRecord(previousAuth) && previousAuth.user === login ? primary : null;
    const next = {
      ...existing,
      defaultAccount: existing.defaultAccount ?? ACCOUNT,
      accounts: { ...accounts, [ACCOUNT]: { ...retainedSettings, ...account(`keychain:${service}`) } },
    };
    const text = `${JSON.stringify(next, null, 2)}\n`;
    try {
      deps.writeMailConfig(config, text);
    } catch {
      await deps.security(["delete-generic-password", "-s", service, "-a", login]);
      deps.say(`The mail config at ${config} could not be written. Setup left it unchanged.`);
      return { ok: false };
    }
    const previousRef = isRecord(previousAuth) && typeof previousAuth.pass === "string" ? previousAuth.pass : "";
    if (previousRef.startsWith(`keychain:${SERVICE_PREFIX}`) && !text.includes(JSON.stringify(previousRef))) {
      const previousService = previousRef.slice("keychain:".length);
      const suffix = previousService.slice(SERVICE_PREFIX.length);
      const previousLogin = isRecord(previousAuth) ? previousAuth.user : null;
      if (typeof previousLogin === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(suffix)) {
        const removed = await deps.security(["delete-generic-password", "-s", previousService, "-a", previousLogin]);
        if (removed.status !== 0) deps.say("The new mail account is saved. The previous Threva password could not be removed from the Keychain.");
      }
    }
    return { ok: true, source };
  }
}

import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeMailConfig } from "../src/cli/mail-config";
import { setupMail } from "../src/cli/setup-mail";
import { setup } from "../src/cli/setup";
import { harness, KEY, LIBEXEC, PREFIX, stackDir, writtenText } from "./fixtures/setup";

const adapter = join(LIBEXEC, "adapters", "bin", "desk-imap.ts");
const bun = join(PREFIX, "bin", "bun");
const config = join(stackDir, "mail.json");
const stack = join(stackDir, "stacks", "threva.yaml");
const calendar = join(PREFIX, "var", "threva", "bin", "desk-calendar-mac");
const login = "newcomer@example.org";
const good = "synthetic mail password";
const bad = "bad synthetic password";
const env = "THREVA_SETUP_IMAP_PASSWORD";
const ok = { status: 0, stdout: "", stderr: "" };

function installed(options: Parameters<typeof harness>[0]) {
  const h = harness(options);
  h.files.set(adapter, "");
  h.deps.which = path => [bun, "bun"].includes(path) ? bun : path === calendar ? path : null;
  return h;
}

test("probes IMAP with desk-imap --config, retries a bad password, and only writes the accepted Keychain reference", async () => {
  const h = installed({ answers: ["1", KEY, "", login, "imap.example.org", "", bad, good] });
  const attempted: string[] = [];
  h.deps.mailProbe = async (command, text, values) => {
    expect(command("/tmp/fixture.json")).toEqual([bun, adapter, "--config", "/tmp/fixture.json", "--account", "personal", "--limit", "1"]);
    expect(JSON.parse(text).accounts.personal.imap).toEqual({
      enabled: true, host: "imap.example.org", port: 993, tls: true, auth: { user: login, pass: `env:${env}` },
    });
    expect(text).not.toContain(values[env]);
    expect(h.files.has(config)).toBe(false);
    expect(h.calls.some(c => c.tool === "security" && c.args.includes(login))).toBe(false);
    attempted.push(values[env]);
    return values[env] === good ? ok : { status: 1, stdout: "", stderr: bad };
  };
  expect(await setup([], h.deps)).toBe(0);
  expect(attempted).toEqual([bad, good]);
  expect(h.said.join("\n")).toContain("IMAP login failed");
  expect(h.said.join("\n")).not.toContain(bad);

  const auth = JSON.parse(h.files.get(config) ?? "").accounts.personal.imap.auth;
  expect(auth.user).toBe(login);
  expect(auth.pass).toMatch(/^keychain:ai\.meta-factory\.threva\.imap\./);
  const keychain = h.calls.find(c => c.tool === "security" && c.args.includes(login));
  expect(keychain?.args).toEqual(["add-generic-password", "-s", auth.pass.slice("keychain:".length), "-a", login, "-w", good]);
  expect(writtenText(h.files)).not.toContain(good);
  expect(writtenText(h.files)).not.toContain(bad);
  expect(JSON.parse(h.files.get(stack) ?? "").mc.desk.sources).toEqual([
    { id: "calendar", command: [calendar, "--days", "5"] },
    { id: "mail", command: [bun, adapter, "--config", config, "--account", "personal"] },
  ]);
});

const existing = JSON.stringify({ defaultAccount: "other", accounts: {
  personal: { imap: { auth: { user: login, pass: "keychain:previous" } } },
  other: { imap: { auth: { pass: "keychain:other" } } },
} });

test("keeps the configured account and secondary accounts on reconfigure after a failed login is skipped", async () => {
  const h = installed({ existing: true, answers: ["1", KEY, "", login, "imap.example.org", "1993", bad, ""] });
  h.files.set(config, existing);
  h.deps.mailProbe = async () => ({ status: 1, stdout: "", stderr: bad });
  expect(await setup(["--reconfigure"], h.deps)).toBe(0);
  expect(h.files.get(config)).toBe(existing);
  expect(JSON.parse(h.files.get(stack) ?? "").mc.desk.sources).toContainEqual({
    id: "mail", command: [bun, adapter, "--config", config, "--account", "personal"],
  });
  expect(h.calls.some(c => c.tool === "security" && c.args.includes(login))).toBe(false);
});

test("preserves the existing config when writing the new keychain reference fails", async () => {
  const h = installed({ existing: true, answers: ["1", KEY, "", login, "imap.example.org", "", good] });
  h.files.set(config, existing);
  const oldStack = h.files.get(stack);
  h.deps.writeMailConfig = () => { throw new Error("Fixture write failure"); };
  expect(await setup(["--reconfigure"], h.deps)).toBe(1);
  expect(h.files.get(config)).toBe(existing);
  expect(h.files.get(stack)).toBe(oldStack);
  const added = h.calls.find(c => c.tool === "security" && c.args[0] === "add-generic-password" && c.args.includes(login));
  expect(added).toBeDefined();
  expect(h.calls.some(c => c.tool === "security" && c.args[0] === "delete-generic-password" && c.args[2] === added?.args[2])).toBe(true);
});

test("the mail step writes only a Keychain reference to a real temporary config path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "threva-mail-fixture-"));
  try {
    const h = installed({ answers: [login, "imap.example.org", "", good] });
    h.deps.writeMailConfig = writeMailConfig;
    expect(await setupMail(LIBEXEC, dir, h.deps)).toMatchObject({ ok: true });
    const path = join(dir, "mail.json");
    const onDisk = await readFile(path, "utf8");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(onDisk).not.toContain(good);
    expect(JSON.parse(onDisk).accounts.personal.imap.auth.pass).toStartWith("keychain:");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("replacing the login preserves other accounts and does not attach the old SMTP identity to the new account", async () => {
  const nextLogin = "next@example.org";
  const h = installed({ existing: true, answers: ["1", KEY, "", nextLogin, "imap.example.org", "", good] });
  const previous = JSON.parse(existing);
  previous.accounts.personal.smtp = { auth: { user: login, pass: "keychain:previous" } };
  h.files.set(config, JSON.stringify(previous));
  expect(await setup(["--reconfigure"], h.deps)).toBe(0);
  const next = JSON.parse(h.files.get(config) ?? "");
  expect(next.defaultAccount).toBe("other");
  expect(next.accounts.other).toEqual(previous.accounts.other);
  expect(next.accounts.personal.imap.auth.user).toBe(nextLogin);
  expect(next.accounts.personal.smtp).toBeUndefined();
});

test("a missing adapter cannot remove a configured mail source during reconfigure", async () => {
  const h = harness({ existing: true, answers: ["1", KEY, ""] });
  h.files.set(config, existing);
  const before = h.files.get(stack);
  expect(await setup(["--reconfigure"], h.deps)).toBe(1);
  expect(h.files.get(config)).toBe(existing);
  expect(h.files.get(stack)).toBe(before);
  expect(h.said.join("\n")).toContain("Reinstall Threva");
});

test("cleans up a replaced Threva-only Keychain entry after saving the new config", async () => {
  const h = installed({ existing: true, answers: ["1", KEY, "", login, "imap.example.org", "", good] });
  const previous = JSON.parse(existing);
  const previousService = "ai.meta-factory.threva.imap.11111111-2222-3333-4444-555555555555";
  previous.accounts.personal.imap.auth.pass = `keychain:${previousService}`;
  h.files.set(config, JSON.stringify(previous));
  const security = h.deps.security;
  h.deps.security = args => {
    if (args[0] === "delete-generic-password") expect(h.files.get(config)).not.toContain(previousService);
    return security(args);
  };
  expect(await setup(["--reconfigure"], h.deps)).toBe(0);
  expect(h.calls).toContainEqual({ tool: "security", args: ["delete-generic-password", "-s", previousService, "-a", login] });
});

test("an adapter execution failure stops setup rather than retrying the password", async () => {
  const h = installed({ answers: ["1", KEY, "", login, "imap.example.org", "", good] });
  h.deps.mailProbe = async () => ({ status: 127, stdout: "", stderr: "" });
  expect(await setup([], h.deps)).toBe(1);
  expect(h.files.has(config)).toBe(false);
  expect(h.files.has(stack)).toBe(false);
  expect(h.said.join("\n")).toContain("IMAP adapter could not run");
});

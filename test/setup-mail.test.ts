import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mailKeychainInput, mailKeychainRestore, storeMailPassword } from "../src/cli/mail-keychain";
import { writeMailConfig } from "../src/cli/mail-config";
import { ADAPTERS, setupMail } from "../src/cli/setup-mail";
import { setup } from "../src/cli/setup";
import { harness, HOME, KEY, LIBEXEC, PREFIX, stackDir, writtenText } from "./fixtures/setup";

const adapterDir = join(LIBEXEC, "adapters", "bin");
const bun = join(PREFIX, "bin", "bun");
const config = join(HOME, ".config", "threva", "mail-accounts.json");
const stack = join(stackDir, "stacks", "threva.yaml");
const calendar = join(PREFIX, "var", "threva", "bin", "desk-calendar-mac");
const name = "personal";
const service = `threva-mail-${name}-fixture`;
const address = "newcomer@example.org";
const login = "fixture-login";
const good = "synthetic mail password";
const bad = "bad synthetic password";
const old = "previous synthetic password";
const reportTo = "report@example.org";
const env = "THREVA_SETUP_IMAP_PASSWORD";
const ok = { status: 0, stdout: "", stderr: "" };
const args = (adapter: string, path = config) => [bun, join(adapterDir, `${adapter}.ts`), "--config", path];
const answers = (account: string, passwords: string[], report = "", auth = login) =>
  [account, address, "imap.example.org", "", "smtp.example.org", "", "", auth, report, ...passwords];

function installed(options: Parameters<typeof harness>[0]) {
  const h = harness(options);
  h.deps.mailServiceId = () => "fixture";
  for (const bin of ADAPTERS) {
    h.files.set(join(adapterDir, `${bin}.ts`), "");
  }
  const security = h.deps.security;
  h.deps.security = async argv => {
    const result = await security(argv);
    return argv[0] === "find-generic-password" ? { ...result, status: 44 } : result;
  };
  h.deps.which = path => path === "bun" ? bun : path === calendar ? path : null;
  return h;
}

const configAccount = (pass: string, auth = login) => ({
  from: { email: address },
  imap: { enabled: true, host: "imap.example.org", port: 993, tls: true, auth: { user: auth, pass } },
  smtp: { host: "smtp.example.org", port: 587, secure: false, auth: { user: auth, pass } },
});

const mailSource = (account: string) => ({ id: `mail-${account}`, command: [...args("desk-imap"), "--account", account, "--sent"], everySeconds: 300, timeoutSeconds: 60 });
const existing = JSON.stringify({ defaultAccount: "other", accounts: {
  personal: configAccount(`keychain:${service}`),
  other: configAccount("keychain:threva-mail-other", "other-login"),
} });

test("probes IMAP with desk-imap --config, redacts the latest diagnostic, retries and wires the working account", async () => {
  const h = installed({ answers: ["1", KEY, "", ...answers(name, [bad, good], reportTo)] });
  const attempted: string[] = [];
  h.deps.mailProbe = async (command, text, values) => {
    expect(command("/tmp/fixture.json")).toEqual([...args("desk-imap", "/tmp/fixture.json"), "--account", name, "--limit", "1"]);
    expect(JSON.parse(text).accounts.personal).toEqual(configAccount(`env:${env}`));
    expect(text).not.toContain(values[env]);
    expect(h.files.has(config)).toBe(false);
    expect(h.mailKeychainInput).toEqual([]);
    attempted.push(values[env]);
    return values[env] === good ? ok : { status: 1, stdout: "", stderr: `old detail\ndenied: ${bad}` };
  };
  expect(await setup([], h.deps)).toBe(0);
  expect(attempted).toEqual([bad, good]);
  expect(h.said.join("\n")).toContain("denied: [redacted]");
  expect(h.said.join("\n")).not.toContain("old detail");
  expect(h.said.join("\n")).not.toContain(bad);

  const saved = h.files.get(config) ?? "";
  expect(JSON.parse(saved)).toMatchObject({ defaultAccount: name, accounts: { personal: configAccount(`keychain:${service}`) } });
  expect(h.mailKeychainInput).toEqual([mailKeychainInput(service, name, good) ?? ""]);
  for (const value of [good, bad]) {
    expect(h.calls.flatMap(c => c.args)).not.toContain(value);
    expect(writtenText(h.files) + saved).not.toContain(value);
  }
  const desk = JSON.parse(h.files.get(stack) ?? "").mc.desk;
  expect(desk.sources).toEqual([{ id: "calendar", command: [calendar, "--days", "5"] }, mailSource(name)]);
  expect(desk.mail.actions).toEqual({ move: args("desk-mail-move"), trash: args("desk-mail-trash"), draft: args("desk-mail-draft") });
  expect(desk.mail.invitations).toEqual({ command: args("desk-mail-invite") });
  expect(desk.mail.report).toEqual({ command: args("desk-mail-report"), to: reportTo });
});

test("keeps configured accounts and sources on reconfigure after a failed login is skipped", async () => {
  const h = installed({ existing: true, answers: ["1", KEY, "", ...answers(name, [bad, ""])] });
  h.files.set(config, existing);
  h.deps.mailProbe = async () => ({ status: 1, stdout: "", stderr: bad });
  expect(await setup(["--reconfigure"], h.deps)).toBe(0);
  expect(h.files.get(config)).toBe(existing);
  const desk = JSON.parse(h.files.get(stack) ?? "").mc.desk;
  expect(desk.sources).toContainEqual(mailSource(name));
  expect(desk.sources).toContainEqual(mailSource("other"));
  expect(desk.mail.report).toBeUndefined();
  expect(h.mailKeychainInput).toEqual([]);
});

function existingKeychain(h: ReturnType<typeof installed>) {
  const security = h.deps.security;
  h.deps.security = async argv => {
    await security(argv);
    return { ...ok, stderr: argv[0] === "find-generic-password" ? `password: "${old}"\n` : "" };
  };
}

test("restores the previous Keychain secret when publishing an updated config fails", async () => {
  const h = installed({ existing: true, answers: ["1", KEY, "", ...answers(name, [good])] });
  h.files.set(config, existing);
  const oldStack = h.files.get(stack);
  existingKeychain(h);
  h.deps.writeMailConfig = () => { throw new Error("Fixture write failure"); };
  expect(await setup(["--reconfigure"], h.deps)).toBe(1);
  expect(h.files.get(config)).toBe(existing);
  expect(h.files.get(stack)).toBe(oldStack);
  expect(h.mailKeychainInput).toEqual([mailKeychainInput(service, name, good, true) ?? "", mailKeychainInput(service, name, old, true) ?? ""]);
  expect(h.calls).not.toContainEqual({ tool: "security", args: ["delete-generic-password", "-s", service, "-a", name] });
});

test("the mail step writes just Keychain references to a real private config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "threva-mail-fixture-"));
  try {
    const h = installed({ answers: answers(name, [good]) });
    h.deps.writeMailConfig = writeMailConfig;
    expect(await setupMail(LIBEXEC, dir, h.deps)).toMatchObject({ ok: true });
    const path = join(dir, ".config", "threva", "mail-accounts.json");
    const text = await readFile(path, "utf8");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(text).not.toContain(good);
    expect(JSON.parse(text).accounts.personal).toEqual(configAccount(`keychain:${service}`));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("replacing a named account preserves other accounts and replaces its IMAP and SMTP identity", async () => {
  const h = installed({ existing: true, answers: ["1", KEY, "", ...answers(name, [good], "", "next-login")] });
  const previous = JSON.parse(existing);
  const oldService = "threva-mail-personal-previous";
  h.files.set(config, JSON.stringify({ ...previous, accounts: { ...previous.accounts, personal: configAccount(`keychain:${oldService}`) } }));
  expect(await setup(["--reconfigure"], h.deps)).toBe(0);
  const next = JSON.parse(h.files.get(config) ?? "");
  expect(next.defaultAccount).toBe("other");
  expect(next.accounts.other).toEqual(previous.accounts.other);
  expect(next.accounts.personal).toEqual(configAccount(`keychain:${service}`, "next-login"));
  expect(JSON.stringify(next)).not.toContain(oldService);
  expect(h.mailKeychainInput).toEqual([mailKeychainInput(service, name, good) ?? ""]);
  expect(JSON.parse(h.files.get(stack) ?? "").mc.desk.sources).toContainEqual(mailSource("other"));
});

test("leaving reporting blank preserves the existing address and a dash explicitly removes it", async () => {
  for (const report of ["", "-"]) {
    const h = installed({ existing: true, answers: ["1", KEY, "", ...answers(name, [good], report)] });
    h.files.set(config, JSON.stringify({ ...JSON.parse(existing), phishingReportTo: reportTo }));
    existingKeychain(h);
    expect(await setup(["--reconfigure"], h.deps)).toBe(0);
    const desk = JSON.parse(h.files.get(stack) ?? "").mc.desk;
    expect(desk.mail.report).toEqual(report === "-" ? undefined : { command: args("desk-mail-report"), to: reportTo });
  }
});

test("missing commands cannot remove a configured mail source during reconfigure", async () => {
  const h = harness({ existing: true, answers: ["1", KEY, ""] });
  h.files.set(config, existing);
  const before = h.files.get(stack);
  expect(await setup(["--reconfigure"], h.deps)).toBe(1);
  expect(h.files.get(config)).toBe(existing);
  expect(h.files.get(stack)).toBe(before);
  expect(h.said.join("\n")).toContain("Reinstall Threva");
});

test("adapter execution failure stops setup rather than retrying the password", async () => {
  const h = installed({ answers: ["1", KEY, "", ...answers(name, [good])] });
  h.deps.mailProbe = async () => ({ status: 127, stdout: "", stderr: "" });
  expect(await setup([], h.deps)).toBe(1);
  expect(h.files.has(config)).toBe(false);
  expect(h.files.has(stack)).toBe(false);
  expect(h.said.join("\n")).toContain("IMAP adapter could not run");
});

test("the Keychain writer sends a single encoded command through stdin and never puts the password in process arguments", async () => {
  const synthetic = "synthetic \" \\ \n café";
  const input = mailKeychainInput("fixture-service", 'login \\ " quoted', synthetic);
  if (!input) throw new Error("Fixture input was rejected");
  const encoded = / -X ([0-9a-f]+)\n$/.exec(input)?.[1];
  expect(input).toContain('\\" quoted"');
  expect(input.split("\n")).toHaveLength(2);
  expect(Buffer.from(encoded ?? "", "hex").toString("utf8")).toBe(synthetic);
  for (const status of [0, 1]) {
    expect(await storeMailPassword(input, async (args, env, stdin) => {
      expect(args).toEqual(["/usr/bin/security", "-i"]);
      expect(env).toBeUndefined();
      expect(await stdin?.text()).toBe(input);
      expect(args).not.toContain(synthetic);
      expect(args).not.toContain(encoded);
      return { ...ok, status };
    })).toBe(status === 0);
  }
  expect(mailKeychainInput("fixture", "bad\nsecond-command", synthetic)).toBeNull();
  expect(mailKeychainInput("fixture", "login", "x".repeat(4096))).toBeNull();
});

test("a failed Keychain process leaves the validated replacement and existing config unapplied", async () => {
  const h = installed({ existing: true, answers: ["1", KEY, "", ...answers(name, [good])] });
  h.files.set(config, existing);
  const previousStack = h.files.get(stack);
  existingKeychain(h);
  h.deps.storeMailPassword = input => storeMailPassword(input, async () => ({ ...ok, status: 1 }));
  expect(await setup(["--reconfigure"], h.deps)).toBe(1);
  expect(h.files.get(config)).toBe(existing);
  expect(h.files.get(stack)).toBe(previousStack);
  expect(h.said.join("\n")).toContain("could not be stored in the Keychain");
});

test.skipIf(process.platform !== "darwin")("macOS security returns failure for an add into an explicit missing Keychain", async () => {
  const dir = await mkdtemp(join(tmpdir(), "threva-keychain-test-"));
  try {
    const missing = join(dir, "uncreated.keychain-db");
    const input = mailKeychainInput("fixture-service", "fixture-account", "synthetic");
    if (!input) throw new Error("Fixture input was rejected");
    expect(await storeMailPassword(`${input.trimEnd()} ${JSON.stringify(missing)}\n`)).toBe(false);
    expect(await Bun.file(missing).exists()).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("recreates a missing Keychain item or recovers a stale item after losing the mail config", async () => {
  const missing = installed({ existing: true, answers: ["1", KEY, "", ...answers(name, [good])] });
  missing.files.set(config, existing);
  expect(await setup(["--reconfigure"], missing.deps)).toBe(0);
  expect(missing.mailKeychainInput).toEqual([mailKeychainInput(service, name, good) ?? ""]);

  const stale = installed({ answers: ["1", KEY, "", ...answers(name, [good])] });
  existingKeychain(stale);
  expect(await setup([], stale.deps)).toBe(0);
  expect(stale.mailKeychainInput).toEqual([mailKeychainInput(service, name, good, true) ?? ""]);
});

test("an encoded Keychain snapshot is restored as exact bytes", () => {
  expect(mailKeychainRestore(service, name, 'password: 0x6669787475726500FF  "fixture"\n')).toContain("-X 6669787475726500FF\n");
  expect(mailKeychainRestore(service, name, 'unexpected response')).toBeNull();
});

test("rejects passwords the pinned adapter cannot read back and preserves internal spaces", async () => {
  const h = installed({ answers: ["1", KEY, "", ...answers(name, [" leading", "trailing ", "non-ASCII é", good])] });
  const probed: string[] = [];
  h.deps.mailProbe = async (_command, _text, values) => {
    probed.push(values[env]);
    return ok;
  };
  expect(await setup([], h.deps)).toBe(0);
  expect(probed).toEqual([good]);
  expect(h.mailKeychainInput).toEqual([mailKeychainInput(service, name, good) ?? ""]);
});

test("keeps an existing account whose name has capital letters", async () => {
  const h = installed({ answers: [""] });
  h.files.set(config, JSON.stringify({ accounts: { Work: configAccount("keychain:threva-mail-Work") } }));
  const result = await setupMail(LIBEXEC, HOME, h.deps);
  expect(result.ok && result.plan.sources.map(source => source.id)).toEqual(["mail-Work"]);
});

test("asks again for a From address wrapped in angle brackets", async () => {
  const h = installed({ answers: ["personal", `<${address}>`, ...answers(name, [good]).slice(1)] });
  const prompts: string[] = [];
  const ask = h.deps.ask;
  h.deps.ask = async (question, ...rest) => {
    prompts.push(question);
    return ask(question, ...rest);
  };
  expect(await setupMail(LIBEXEC, HOME, h.deps)).toMatchObject({ ok: true });
  const from = prompts.filter(question => question === "Mail address: ");
  expect(from.length).toBe(2);
  expect(JSON.parse(h.files.get(config) ?? "").accounts.personal.from.email).toBe(address);
});

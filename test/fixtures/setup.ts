import { join } from "node:path";
import { stackPaths, type RunResult, type SetupDeps } from "../../src/cli/setup";

export const HOME = "/Users/newcomer";
export const PREFIX = "/opt/homebrew";
export const LIBEXEC = `${PREFIX}/opt/threva/libexec`;
export const KEY = "synthetic-test-key-123";
const ok: RunResult = { status: 0, stdout: "", stderr: "" };

interface Harness {
  deps: SetupDeps;
  files: Map<string, string>;
  said: string[];
  calls: { tool: string; args: string[] }[];
  mailKeychainInput: string[];
  posts: { url: string; body: string }[];
}

export function harness(options: { answers: string[]; claude?: boolean; bun?: string; engines?: string | null; existing?: boolean; securityStatus?: number; validateStatus?: number; portTaken?: boolean; unfinished?: boolean; writtenPort?: number }): Harness {
  const files = new Map<string, string>([
    [`${LIBEXEC}/cortex/src/cortex.ts`, ""],
    [`${LIBEXEC}/ui/index.html`, ""],
  ]);
  if (options.engines !== null) files.set(`${LIBEXEC}/cortex/package.json`, JSON.stringify({ engines: { bun: options.engines ?? ">=1.4.4" } }));
  if (options.existing || options.unfinished) {
    files.set(stackPaths(HOME).pointer, "# old\n");
    files.set(join(stackPaths(HOME).dir, "stacks", "threva.yaml"), JSON.stringify({ mc: { port: options.writtenPort ?? 8767 } }));
  }
  if (options.existing) files.set(stackPaths(HOME).finished, "2026-11-16T00:00:00.000Z\n");
  const mailKeychainInput: string[] = [];
  const said: string[] = [];
  const calls: Harness["calls"] = [];
  const posts: Harness["posts"] = [];
  const answers = [...options.answers];
  const record = (tool: string, status = 0) => async (args: string[]): Promise<RunResult> => {
    calls.push({ tool, args });
    if (tool === "brew" && args[0] === "--prefix") return { ...ok, stdout: `${PREFIX}\n` };
    return { status, stdout: "", stderr: status === 0 ? "" : `${tool} failed` };
  };
  const deps: SetupDeps = {
    home: HOME,
    user: "Newcomer",
    bunVersion: options.bun ?? "1.4.4",
    ask: async () => {
      const next = answers.shift();
      if (next === undefined) throw new Error("ran out of answers");
      return next;
    },
    say: (line) => said.push(line),
    which: (command) => (command === "claude" && options.claude ? "/usr/local/bin/claude" : null),
    readFile: (path) => files.get(path) ?? null,
    writeFile: (path, text) => files.set(path, text),
    mkdir: (path) => calls.push({ tool: "mkdir", args: [path] }),
    adapter: record("adapter"),
    mailProbe: command => record("mailProbe")(command("/tmp/threva-fixture/mail.json")),
    storeMailPassword: async input => { mailKeychainInput.push(input); return true; },
    writeMailConfig: (path, text) => files.set(path, text),
    security: record("security", options.securityStatus),
    brew: record("brew"),
    git: (args, cwd) => record("git")([cwd, ...args]),
    validate: (cortexDir, pointer) => record("validate", options.validateStatus)([cortexDir, pointer]),
    open: (url) => record("open")([url]),
    fetch: async (url, init) => {
      const started = calls.some((c) => c.tool === "brew" && c.args[0] === "services" && c.args[2] === "threva");
      if (!started && !options.portTaken) throw new TypeError("Unable to connect");
      if (init?.method === "POST") posts.push({ url, body: init.body as string });
      return new Response("{}", { status: 200 });
    },
    sleep: async () => {},
  };
  return { deps, files, said, calls, posts, mailKeychainInput };
}

export const stackDir = stackPaths(HOME).dir;
export const writtenText = (files: Map<string, string>) => [...files].filter(([path]) => path.startsWith(stackDir)).map(([, text]) => text).join("\n");

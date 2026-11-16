import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { bunMeetsEngines, parseSetupArgs, principalId, setup, stackPaths, type RunResult, type SetupDeps } from "../src/cli/setup";

const HOME = "/Users/newcomer";
const PREFIX = "/opt/homebrew";
const LIBEXEC = `${PREFIX}/opt/threva/libexec`;
const KEY = "synthetic-test-key-123";
const ok: RunResult = { status: 0, stdout: "", stderr: "" };

interface Harness {
  deps: SetupDeps;
  files: Map<string, string>;
  said: string[];
  calls: { tool: string; args: string[] }[];
  posts: { url: string; body: string }[];
}

function harness(options: { answers: string[]; claude?: boolean; bun?: string; engines?: string | null; existing?: boolean; securityStatus?: number; validateStatus?: number; portTaken?: boolean; unfinished?: boolean }): Harness {
  const files = new Map<string, string>([
    [`${LIBEXEC}/cortex/src/cortex.ts`, ""],
    [`${LIBEXEC}/ui/index.html`, ""],
  ]);
  if (options.engines !== null) files.set(`${LIBEXEC}/cortex/package.json`, JSON.stringify({ engines: { bun: options.engines ?? ">=1.4.4" } }));
  if (options.existing || options.unfinished) files.set(stackPaths(HOME).pointer, "# old\n");
  if (options.existing) files.set(stackPaths(HOME).finished, "2026-11-16T00:00:00.000Z\n");
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
  return { deps, files, said, calls, posts };
}

const stackDir = stackPaths(HOME).dir;
const writtenText = (files: Map<string, string>) => [...files].filter(([path]) => path.startsWith(stackDir)).map(([, text]) => text).join("\n");

describe("threva setup", () => {
  test("writes the config-split stack with the bundle defaults and stores the Anthropic key only in the Keychain", async () => {
    const h = harness({ answers: ["1", KEY, ""] });
    expect(await setup([], h.deps)).toBe(0);

    expect(h.files.get(join(stackDir, "threva.yaml"))).toBeDefined();
    const system = JSON.parse(h.files.get(join(stackDir, "system", "system.yaml")) ?? "");
    expect(system.nats.url).toBe("nats://127.0.0.1:4222");
    expect(system.inference.providers.anthropic).toEqual({ protocol: "anthropic-messages", baseUrl: "https://api.anthropic.com", apiKey: "env:ANTHROPIC_API_KEY" });
    expect(system.discord).toBeUndefined();

    const stack = JSON.parse(h.files.get(join(stackDir, "stacks", "threva.yaml")) ?? "");
    expect(stack.stack.id).toBe("newcomer/threva");
    expect(stack.mc.ui.dir).toBe(`${LIBEXEC}/ui`);
    expect(stack.mc.desk.mail.rules.proposeAfter).toBe(3);
    expect(stack.mc.desk.interruptions).toEqual({ transport: "none", notifications: true });

    expect(writtenText(h.files)).not.toContain(KEY);
    expect(h.calls.find((c) => c.tool === "security")?.args).toEqual([
      "add-generic-password", "-U", "-s", "ai.meta-factory.cortex.cortex.ANTHROPIC_API_KEY", "-a", "Newcomer", "-w", KEY,
    ]);
  });

  test("starts the services, switches ranked mail off, then opens the UI", async () => {
    const h = harness({ answers: ["1", KEY, ""] });
    await setup([], h.deps);
    const order = h.calls.filter((c) => c.tool === "brew" || c.tool === "open").map((c) => `${c.tool} ${c.args.join(" ")}`);
    expect(order).toEqual(["brew --prefix", "brew services start nats-server", "brew services start threva", "open http://127.0.0.1:8767/"]);
    expect(h.posts).toEqual([{ url: "http://127.0.0.1:8767/api/desk/interruptions", body: JSON.stringify({ code: "mail.ranked", on: false }) }]);
  });

  test("an OpenAI-compatible endpoint writes its base URL and an env reference to its key", async () => {
    const h = harness({ answers: ["2", "https://llm.example.org/v1/", KEY, ""] });
    expect(await setup([], h.deps)).toBe(0);
    const system = JSON.parse(h.files.get(join(stackDir, "system", "system.yaml")) ?? "");
    expect(system.inference.providers["openai-compatible"]).toEqual({ protocol: "openai-chat-completions", baseUrl: "https://llm.example.org/v1", apiKey: "env:OPENAI_API_KEY" });
    expect(h.calls.find((c) => c.tool === "security")?.args).toContain("ai.meta-factory.cortex.cortex.OPENAI_API_KEY");
    expect(writtenText(h.files)).not.toContain(KEY);
  });

  test("offers the Claude Code login only when claude is on PATH, and stores nothing for it", async () => {
    const without = harness({ answers: ["3", "1", KEY, ""] });
    await setup([], without.deps);
    expect(without.said.some((line) => line.includes("Claude Code"))).toBe(false);
    expect(without.said).toContain("Type a number from 1 to 2.");

    const withClaude = harness({ answers: ["3", ""], claude: true });
    expect(await setup([], withClaude.deps)).toBe(0);
    expect(withClaude.calls.some((c) => c.tool === "security")).toBe(false);
    const system = JSON.parse(withClaude.files.get(join(stackDir, "system", "system.yaml")) ?? "");
    expect(system.inference).toBeUndefined();
  });

  test("an ntfy topic sets the command transport through threva ntfy", async () => {
    const h = harness({ answers: ["1", KEY, "http://ntfy.example.org/t", "https://ntfy.example.org/my-topic"] });
    expect(await setup([], h.deps)).toBe(0);
    const stack = JSON.parse(h.files.get(join(stackDir, "stacks", "threva.yaml")) ?? "");
    expect(stack.mc.desk.interruptions).toEqual({
      transport: "command",
      command: [`${PREFIX}/bin/threva`, "ntfy", "https://ntfy.example.org/my-topic"],
      notifications: true,
    });
  });

  test("a Bun older than Cortex's engines.bun stops before anything is written or stored", async () => {
    const h = harness({ answers: [], bun: "1.3.9" });
    expect(await setup([], h.deps)).toBe(1);
    expect(h.said.at(-1)).toBe("Cortex needs Bun >=1.4.4, and this Bun is 1.3.9. Run brew upgrade bun, then run threva setup again.");
    expect(writtenText(h.files)).toBe("");
    expect(h.calls.filter((c) => c.tool !== "brew")).toEqual([]);
  });

  test("an existing stack is left alone without --reconfigure, and says so", async () => {
    const h = harness({ answers: [], existing: true });
    expect(await setup([], h.deps)).toBe(0);
    expect(h.said.at(-1)).toBe(`A Threva stack already exists at ${stackDir}. Setup changed nothing. Run threva setup --reconfigure to set it up again.`);
    expect(h.files.get(stackPaths(HOME).pointer)).toBe("# old\n");
    expect(h.calls.map((c) => c.tool)).toEqual(["brew"]);
  });

  test("--reconfigure rewrites an existing stack, restarts the service and keeps the user's interruption switches", async () => {
    const h = harness({ answers: ["1", KEY, ""], existing: true });
    expect(await setup(["--reconfigure"], h.deps)).toBe(0);
    expect(h.files.get(stackPaths(HOME).pointer)).not.toBe("# old\n");
    expect(h.calls.filter((c) => c.tool === "brew").map((c) => c.args.join(" "))).toContain("services restart threva");
    expect(h.posts).toEqual([]);
  });

  test("a re-run after a setup that failed before the service answered finishes it as a fresh stack", async () => {
    const h = harness({ answers: ["1", KEY, ""], unfinished: true, portTaken: true });
    expect(await setup([], h.deps)).toBe(0);
    expect(h.calls.filter((c) => c.tool === "brew").map((c) => c.args.join(" "))).toContain("services restart threva");
    expect(h.posts.map((p) => p.body)).toEqual([JSON.stringify({ code: "mail.ranked", on: false })]);
    expect(h.files.get(stackPaths(HOME).finished)).toBeDefined();
  });

  test("a setup whose service never answers leaves no finished marker", async () => {
    const h = harness({ answers: ["1", KEY, ""] });
    h.deps.fetch = async () => {
      throw new TypeError("Unable to connect");
    };
    expect(await setup([], h.deps)).toBe(1);
    expect(h.files.get(stackPaths(HOME).finished)).toBeUndefined();
    expect(h.said.at(-1)).toContain("threva doctor --log");
  });

  test("another program on the port stops a fresh setup before it asks or writes anything", async () => {
    const h = harness({ answers: [], portTaken: true });
    expect(await setup([], h.deps)).toBe(1);
    expect(h.said.at(-1)).toBe("Another program already answers on port 8767, perhaps another Cortex. Stop it, or run threva setup --port <port> with a free port.");
    expect(writtenText(h.files)).toBe("");
    expect(h.posts).toEqual([]);
  });

  test("--port puts the stack and the browser on that port", async () => {
    const h = harness({ answers: ["1", KEY, ""] });
    expect(await setup(["--port", "8795"], h.deps)).toBe(0);
    expect(JSON.parse(h.files.get(join(stackDir, "stacks", "threva.yaml")) ?? "").mc.port).toBe(8795);
    expect(h.calls.find((c) => c.tool === "open")?.args).toEqual(["http://127.0.0.1:8795/"]);
    expect(h.posts[0]?.url).toBe("http://127.0.0.1:8795/api/desk/interruptions");
  });

  test("a Keychain failure stops setup before the stack is written", async () => {
    const h = harness({ answers: ["1", KEY, ""], securityStatus: 1 });
    expect(await setup([], h.deps)).toBe(1);
    expect(writtenText(h.files)).toBe("");
    expect(h.said.at(-1)).toContain("Setup changed nothing.");
  });

  test("a config Cortex refuses stops before the services start", async () => {
    const h = harness({ answers: ["1", KEY, ""], validateStatus: 1 });
    expect(await setup([], h.deps)).toBe(1);
    expect(h.calls.some((c) => c.tool === "brew" && c.args[0] === "services")).toBe(false);
  });
});

describe("setup helpers", () => {
  test("a Cortex without engines.bun fails closed", () => {
    expect(bunMeetsEngines(JSON.stringify({}), "1.4.4").ok).toBe(false);
    expect(bunMeetsEngines(null, "1.4.4").ok).toBe(false);
    expect(bunMeetsEngines(JSON.stringify({ engines: { bun: ">=1.4.4" } }), "1.5.0").ok).toBe(true);
  });

  test("the principal id is a slug of the user name", () => {
    expect(principalId("Jane Doe")).toBe("jane-doe");
    expect(principalId("")).toBe("threva");
  });

  test("unknown arguments print the usage", () => {
    expect(parseSetupArgs(["--force"]).ok).toBe(false);
    expect(parseSetupArgs(["--port", "80"]).ok).toBe(false);
    expect(parseSetupArgs(["--cortex", "/x", "--reconfigure"])).toEqual({ ok: true, value: { reconfigure: true, cortex: "/x", ui: null, port: 8767 } });
  });
});

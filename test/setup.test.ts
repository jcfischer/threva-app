import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { bunMeetsEngines, parseSetupArgs, principalId, setup, stackPaths } from "../src/cli/setup";
import { HOME, PREFIX, LIBEXEC, KEY, harness, stackDir, writtenText } from "./fixtures/setup";

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
    expect(h.posts.map(({ body }) => JSON.parse(body))).toEqual([{ code: "mail.ranked", on: false }]);
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

  test("a re-run on a different port than the unfinished stack still refuses a port another program answers on", async () => {
    const h = harness({ answers: [], unfinished: true, writtenPort: 9000, portTaken: true });
    expect(await setup([], h.deps)).toBe(1);
    expect(h.said.at(-1)).toContain("Another program already answers on port 8767");
    expect(h.posts).toEqual([]);
  });

  test("--reconfigure onto a taken port refuses before it asks anything", async () => {
    const h = harness({ answers: [], existing: true, portTaken: true });
    expect(await setup(["--reconfigure", "--port", "8795"], h.deps)).toBe(1);
    expect(h.said.at(-1)).toContain("Another program already answers on port 8795");
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
    expect(new URL(h.posts[0].url).origin).toBe("http://127.0.0.1:8795");
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

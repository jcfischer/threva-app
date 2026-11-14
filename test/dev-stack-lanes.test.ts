import { describe, expect, test } from "bun:test";
import { deskExtras, operatorHome, readOperatorFiles, renderHomeWrapper, wrapperPaths } from "../scripts/dev-stack-lanes";
import { renderConfig } from "../scripts/dev-stack-lib";

const LANES = `local: {provider: local-provider, model: local-model}
cloud:
  - {id: codex, provider: openai-codex, model: codex-model}
  - {id: claude, provider: anthropic, model: claude-model}
`;
const ROUTING = JSON.stringify({ version: 1, ranger: { command: "ranger", config: "/r.yaml" }, timeoutMs: 25000, permitted: ["claude", "codex", "pi"], providers: {} });
const files: Record<string, string> = { "/op/lanes.yaml": LANES, "/op/routing.json": ROUTING, "/op/broken.yaml": "local: [unclosed\n", "/op/list.yaml": "- a\n" };
const read = (path: string) => files[path] ?? null;
const paths = { cortexDir: "/c", adaptersDir: "/a", stateDir: "/s", uiDir: "/repo/dist/ui", bun: "/bin/bun", port: 8790 };

describe("readOperatorFiles", () => {
  test("without either variable, there is nothing to add and the config is as before", () => {
    const r = readOperatorFiles({}, read);
    expect(r).toEqual({ ok: true, value: {} });
    expect(renderConfig(paths, r.ok ? deskExtras(r.value, wrapperPaths("/s"), "/bin/bun", "/a") : {})).toBe(renderConfig(paths));
  });

  test("names the variable when the lanes file is missing or not YAML", () => {
    for (const file of ["/op/none.yaml", "/op/broken.yaml", "/op/list.yaml"]) {
      expect(readOperatorFiles({ THREVA_DEV_LANES: file }, read)).toEqual({ ok: false, error: expect.stringContaining("THREVA_DEV_LANES") });
    }
    expect(readOperatorFiles({ THREVA_DEV_PARSER_ROUTING: "/op/lanes.yaml" }, read)).toEqual({ ok: false, error: expect.stringContaining("THREVA_DEV_PARSER_ROUTING") });
  });

  test("resolves a relative routing path, so the parser Cortex starts can read it", () => {
    const seen: string[] = [];
    const r = readOperatorFiles({ THREVA_DEV_PARSER_ROUTING: "routing.json" }, (path) => {
      seen.push(path);
      return ROUTING;
    });
    const expected = `${process.cwd()}/routing.json`;
    expect(seen).toEqual([expected]);
    expect(r.ok && r.value.routing?.file).toBe(expected);
  });

  test("keeps only the parser providers Cortex accepts and allows the parser's deadline", () => {
    const r = readOperatorFiles({ THREVA_DEV_PARSER_ROUTING: "/op/routing.json" }, read);
    expect(r).toEqual({ ok: true, value: { routing: { file: "/op/routing.json", permitted: ["codex", "pi"], timeoutSeconds: 30 } } });
  });
});

describe("config with lanes and parser routing", () => {
  const r = readOperatorFiles({ THREVA_DEV_LANES: "/op/lanes.yaml", THREVA_DEV_PARSER_ROUTING: "/op/routing.json" }, read);
  if (!r.ok) throw new Error(r.error);
  const yaml = renderConfig(paths, deskExtras(r.value, wrapperPaths("/s"), "/bin/bun", "/a"));
  const desk = (Bun.YAML.parse(yaml) as { mc: { desk: { conversations: Record<string, unknown>; ask: Record<string, unknown> } } }).mc.desk;

  test("puts the lanes under mc.desk.conversations and runs pi through the wrapper", () => {
    expect(desk.conversations).toEqual({
      local: { provider: "local-provider", model: "local-model" },
      cloud: [
        { id: "codex", provider: "openai-codex", model: "codex-model" },
        { id: "claude", provider: "anthropic", model: "claude-model" },
      ],
      pi: { bin: "/s/bin/pi" },
    });
  });

  test("runs the routed parser with the operator's routing file", () => {
    expect(desk.ask).toEqual({
      parser: ["/s/bin/with-operator-home", "/bin/bun", "/a/bin/desk-parse.ts", "--routing-config", "/op/routing.json"],
      routing: { permitted: ["codex", "pi"] },
      timeoutSeconds: 30,
    });
  });
});

describe("the wrapper", () => {
  test("runs pi with the operator's HOME and XDG directories", () => {
    const operator = operatorHome({ HOME: "/Users/o'k", XDG_CONFIG_HOME: "/Users/o'k/.cfg" });
    if (!operator) throw new Error("no operator home");
    const script = renderHomeWrapper(operator, "/usr/local/bin/pi");
    expect(script.split("\n")).toEqual([
      "#!/bin/sh",
      "export HOME='/Users/o'\\''k'",
      "export XDG_CONFIG_HOME='/Users/o'\\''k/.cfg'",
      "unset XDG_STATE_HOME",
      "unset XDG_DATA_HOME",
      "exec '/usr/local/bin/pi' \"$@\"",
      "",
    ]);
  });

  test("restores the HOME in a real shell", () => {
    const operator = operatorHome({ HOME: "/tmp/operator home" });
    if (!operator) throw new Error("no operator home");
    const r = Bun.spawnSync(["/bin/sh", "-c", renderHomeWrapper(operator), "wrapper", "/bin/sh", "-c", 'printf %s "$HOME|${XDG_CONFIG_HOME-unset}"'], {
      env: { PATH: "/usr/bin:/bin", HOME: "/s/home", XDG_CONFIG_HOME: "/s/home/.config" },
    });
    expect(r.stdout.toString()).toBe("/tmp/operator home|unset");
  });
});

describe("the Studio filer", () => {
  const FILER = `baseUrl: https://models.example.org/v1
model: capture-model
apiKeyFile: secrets/capture
timeoutSeconds: 30
local:
  baseUrl: http://127.0.0.1:8080/v1
  model: local-capture-model
  caFile: /op/ca
`;
  const filerFiles: Record<string, string> = {
    ...files,
    "/op/filer.yaml": FILER,
    "/op/local-only.yaml": "local: {baseUrl: http://127.0.0.1:8080/v1, model: m}\n",
    "/op/no-model.yaml": "baseUrl: https://x/v1\n",
    "/op/inline-key.yaml": "baseUrl: https://x/v1\nmodel: m\napiKey: not-a-real-value\n",
    "/op/inline-local-key.yaml": "local: {baseUrl: https://x/v1, model: m, apiKey: not-a-real-value}\n",
  };
  const readFiler = (path: string) => filerFiles[path] ?? null;

  test("names the variable when the file is missing, not a mapping or lacks baseUrl and model", () => {
    for (const file of ["/op/none.yaml", "/op/broken.yaml", "/op/list.yaml", "/op/no-model.yaml", "/op/lanes.yaml"]) {
      expect(readOperatorFiles({ THREVA_DEV_STUDIO_FILER: file }, readFiler)).toEqual({ ok: false, error: expect.stringContaining("THREVA_DEV_STUDIO_FILER") });
    }
  });

  test("refuses fields Cortex's filer does not take, so a key never lands in the config by value", () => {
    for (const file of ["/op/inline-key.yaml", "/op/inline-local-key.yaml"]) {
      const r = readOperatorFiles({ THREVA_DEV_STUDIO_FILER: file }, readFiler);
      expect(r).toEqual({ ok: false, error: expect.stringContaining("apiKey") });
      expect(r.ok ? "" : r.error).not.toContain("not-a-real-value");
    }
  });

  test("accepts a filer with only a local endpoint", () => {
    const r = readOperatorFiles({ THREVA_DEV_STUDIO_FILER: "/op/local-only.yaml" }, readFiler);
    expect(r).toEqual({ ok: true, value: { studioFiler: { local: { baseUrl: "http://127.0.0.1:8080/v1", model: "m" } } } });
  });

  test("resolves a relative filer path, and relative files in it against the filer's directory", () => {
    const seen: string[] = [];
    const r = readOperatorFiles({ THREVA_DEV_STUDIO_FILER: "op/filer.yaml" }, (path) => {
      seen.push(path);
      return FILER;
    });
    expect(seen).toEqual([`${process.cwd()}/op/filer.yaml`]);
    expect(r.ok && r.value.studioFiler?.apiKeyFile).toBe(`${process.cwd()}/op/secrets/capture`);
  });

  test("renders the block under mc.desk.studio.filer, beside the Studio directory", () => {
    const r = readOperatorFiles({ THREVA_DEV_STUDIO_FILER: "/op/filer.yaml" }, readFiler);
    if (!r.ok) throw new Error(r.error);
    const yaml = renderConfig(paths, deskExtras(r.value, wrapperPaths("/s"), "/bin/bun", "/a"));
    const studio = (Bun.YAML.parse(yaml) as { mc: { desk: { studio: Record<string, unknown> } } }).mc.desk.studio;
    expect(studio).toEqual({
      dir: "/s/studio",
      filer: {
        baseUrl: "https://models.example.org/v1",
        model: "capture-model",
        apiKeyFile: "/op/secrets/capture",
        timeoutSeconds: 30,
        local: { baseUrl: "http://127.0.0.1:8080/v1", model: "local-capture-model", caFile: "/op/ca" },
      },
    });
  });
});

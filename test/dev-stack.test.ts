import { describe, expect, test } from "bun:test";
import { DEFAULT_PORT, devEnv, renderCalendar, renderConfig, renderMail, resolvePaths } from "../scripts/dev-stack-lib";

const all = () => true;
const env = { CORTEX_DIR: "/c", CORTEX_ADAPTERS_DIR: "/a", HOME: "/h" };

describe("resolvePaths", () => {
  test("defaults the state directory and port", () => {
    const r = resolvePaths(env, "/repo", "/bin/bun", all);
    expect(r).toEqual({ ok: true, value: { cortexDir: "/c", adaptersDir: "/a", stateDir: "/h/work/threva-dev", uiDir: "/repo/dist/ui", bun: "/bin/bun", port: DEFAULT_PORT } });
  });

  test("names the missing variable", () => {
    expect(resolvePaths({ ...env, CORTEX_DIR: undefined }, "/repo", "/bin/bun", all)).toEqual({ ok: false, error: expect.stringContaining("CORTEX_DIR") });
    expect(resolvePaths({ ...env, CORTEX_ADAPTERS_DIR: undefined }, "/repo", "/bin/bun", all)).toEqual({ ok: false, error: expect.stringContaining("CORTEX_ADAPTERS_DIR") });
  });

  test("refuses a directory without the expected files", () => {
    const r = resolvePaths(env, "/repo", "/bin/bun", (p) => !p.endsWith("cortex.ts"));
    expect(r.ok).toBe(false);
  });

  test("refuses the principal's Mission Control port", () => {
    expect(resolvePaths({ ...env, THREVA_DEV_PORT: "8767" }, "/repo", "/bin/bun", all).ok).toBe(false);
  });
});

describe("renderConfig", () => {
  const yaml = renderConfig({ cortexDir: "/c", adaptersDir: "/a", stateDir: "/s", uiDir: "/repo/dist/ui", bun: "/bin/bun", port: 8790 });

  test("serves the UI directory on its own port, with sample sources", () => {
    expect(yaml).toContain("port: 8790");
    expect(yaml).toContain('ui: {dir: "/repo/dist/ui"}');
    expect(yaml).toContain('"/a/bin/desk-ics.ts", "/s/sample/calendar.ics"');
    expect(yaml).toContain('[/bin/cat, "/s/sample/mail.json"]');
  });

  test("has no bus, Discord or Ranger", () => {
    expect(yaml).not.toMatch(/nats|discord|ranger/i);
  });
});

test("devEnv points every Cortex directory into the state directory and drops the bus URL", () => {
  const e = devEnv("/s", { PATH: "/usr/bin", NATS_URL: "nats://127.0.0.1:4222", HOME: "/Users/x" });
  expect(e.HOME).toBe("/s/home");
  expect(e.CORTEX_CONFIG_DIR).toBe("/s/config");
  expect(e.NATS_URL).toBeUndefined();
  expect(e.PATH).toBe("/usr/bin");
});

test("sample data is relative to now: a meeting soon and one that just ended", () => {
  const now = Date.parse("2026-11-13T16:00:30Z");
  const ics = renderCalendar(now);
  expect(ics).toContain("DTSTART:20261113T160600Z");
  expect(ics).toContain("DTEND:20261113T154500Z");
  const mail = JSON.parse(renderMail(now)) as { items: { receivedAt: string }[] };
  expect(mail.items.length).toBe(3);
  expect(mail.items[0]?.receivedAt).toBe("2026-11-13T15:20:30.000Z");
});

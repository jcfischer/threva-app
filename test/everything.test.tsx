import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "../src/ui/api/client";
import { ViewSwitch } from "../src/ui/app";
import { destinations, dropMove, moveTo, pathTo, stepMove } from "../src/ui/everything/moves";
import { relativeDay, rowCounts, rowTime } from "../src/ui/everything/time";
import { EverythingView } from "../src/ui/everything/view";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { DATE, outlineFixture, row } from "./fixtures/outline";

const fixture = outlineFixture();
const root = fixture.outline;
const find = (id: string) => pathTo(root, id)!.at(-1)!;

describe("outline time margins", () => {
  test("precedence is done, put away, starts, due, with overdue warning and no empty label", () => {
    expect(rowTime(find("done"), DATE)).toMatchObject({ state: "done", margin: "done yesterday", warning: false });
    expect(rowTime(find("away"), DATE)).toMatchObject({ state: "later", margin: "put away until Mon", back: "2026-11-16", warning: false });
    expect(rowTime({ ...find("away"), deferredUntil: DATE }, DATE)).toMatchObject({ state: "later", margin: "starts Tue" });
    expect(rowTime(find("starts"), DATE)).toMatchObject({ state: "later", margin: "starts Nov 23" });
    expect(rowTime(find("due"), DATE)).toMatchObject({ state: "open", margin: "due today", warning: false });
    expect(rowTime(find("late"), DATE)).toMatchObject({ state: "open", margin: "was due last Wed", warning: true });
    expect(rowTime(find("plain"), DATE)).toMatchObject({ state: "open", margin: "" });
    expect(rowTime(row("done", { done: true, dueDate: "2026-11-12" }), DATE).margin).toBe("Done");
  });

  test("done repeats use the engine's reappearance date including lead days and exhausted repeats", () => {
    expect(rowTime(find("weekly"), DATE)).toMatchObject({ state: "later", margin: "done last Thu · back Wed · every week", back: "2026-11-18" });
    expect(rowTime(find("monthly"), DATE)).toMatchObject({ state: "later", margin: "done Oct 31 · back Jan 17, 2027 · every 3 months", back: "2027-01-17" });
    const exhausted = { ...find("weekly"), recurrence: { returnsOn: null, reappearsOn: null, finished: true } };
    expect(rowTime(exhausted, DATE)).toEqual({ state: "done", margin: "done last Thu · every week", warning: false });
    expect(rowCounts(exhausted, DATE)).toEqual({ open: 0, later: 0, back: undefined });
    expect(rowCounts(row("area", { children: [exhausted, find("weekly"), find("plain")] }), DATE)).toEqual({ open: 1, later: 1, back: "2026-11-18" });
    expect(rowTime({ ...find("weekly"), recurrence: undefined }, DATE).back).toBeUndefined();
  });

  test("open repeat rhythm is appended and all presentation is localized", () => {
    const repeating = row("rhythm", { dueDate: DATE, repeat: { unit: "week", interval: 2, weekdays: [1, 3] } });
    expect(rowTime(repeating, DATE).margin).toBe("due today · every 2 weeks on Mon and Wed");
    expect(rowTime(repeating, DATE, createI18n("de")).margin).toBe("fällig heute · alle 2 Wochen am Mo und Mi");
    expect(relativeDay("2026-11-15", DATE, createI18n("en"))).toBe("tomorrow");
    expect(rowCounts(find("area:work"), DATE)).toEqual({ open: 3, later: 4, back: "2026-11-16" });
  });
});

describe("outline move indexes", () => {
  test("up and down count hidden done rows and grey rows, using post-removal indexes", () => {
    expect(stepMove(root, "plain", "up")).toEqual({ parent: "project", index: 1 });
    expect(stepMove(root, "plain", "down")).toEqual({ parent: "project", index: 3 });
    expect(stepMove(root, "due", "up")).toBeNull();
    expect(stepMove(root, "done", "down")).toBeNull();
    expect(dropMove(root, "due", "plain", "after")).toEqual({ parent: "project", index: 2 });
    expect(dropMove(root, "plain", "due", "before")).toEqual({ parent: "project", index: 0 });
    expect(dropMove(root, "plain", "away", "after")).toBeNull();
  });
  test("out stays below an area and into can cross areas; cycles and area moves are refused", () => {
    expect(stepMove(root, "plain", "out")).toEqual({ parent: "area:work", index: 1 });
    expect(stepMove(root, "project", "out")).toBeNull();
    expect(dropMove(root, "plain", "area:me", "into")).toEqual({ parent: "area:me", index: 0 });
    expect(dropMove(root, "area:work", "area:me", "into")).toBeNull();
    expect(moveTo(root, "project", "plain", 0)).toBeNull();
    expect(moveTo(root, "due", "done", 0)).toBeNull();
    expect(destinations(root, "project").map(d => d.id)).toEqual(["area:work", "area:me"]);
    expect(pathTo(root, "missing")).toBeNull();
  });
});

test("static Everything surface lists only areas, with summaries and no movable areas", () => {
  const html = renderToStaticMarkup(<EverythingView client={createClient()} initialDay={fixture} />);
  expect(html).toContain("3 open");
  expect(html).toContain("4 later, next back Mon");
  expect(html).toContain("nothing open");
  expect(html).toContain("Work");
  expect(html).toContain("<h2>Outline</h2>");
  expect(html).not.toContain("Write the script");
  expect(html).not.toContain("Move Work");
  const translated = renderToStaticMarkup(<I18nProvider value={createI18n("de")}><EverythingView client={createClient()} initialDay={fixture} /></I18nProvider>);
  expect(translated).toContain("Alles");
  expect(translated).toContain("3 offen");
  expect(translated).toContain("Work");
  const toggle = renderToStaticMarkup(<ViewSwitch view="everything" onChange={() => {}} />);
  expect(toggle).toContain('aria-pressed="false">Day');
  expect(toggle).toContain('aria-pressed="true">Everything');
});

test("write client sends UUID, date, revision and the command over HTTP, and preserves Cortex refusals", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const client = createClient(async (url, init) => {
    calls.push({ url, init });
    return init ? Response.json({ error: "The outline changed. Your draft is kept." }, { status: 409 }) : Response.json(fixture);
  });
  expect(await client.myDay()).toEqual({ ok: true, data: fixture });
  for (const command of [
    { op: "outline-add", revision: 12, parent: "project", title: "New" } as const,
    { op: "outline-move", revision: 12, id: "plain", parent: "area:me", index: 0 } as const,
    { op: "outline-complete", revision: 12, id: "due", confirm: true } as const,
    { op: "outline-reopen", revision: 12, id: "done", confirm: true } as const,
  ]) {
    expect(await client.changeOutline(DATE, command)).toEqual({ ok: false, status: 409, message: "The outline changed. Your draft is kept." });
    const call = calls.at(-1)!;
    expect(call.url).toBe("/api/desk/my-day");
    expect(call.init?.method).toBe("POST");
    const body = JSON.parse(call.init!.body as string);
    expect(body).toMatchObject({ date: DATE, command });
    expect(body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
});

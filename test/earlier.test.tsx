import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DeskEvent, DoneEntry, StudioList, StudioThread, TodayTask } from "../src/ui/api/types";
import { buildEarlier, closedToday, doneToday, winsToday, type EarlierLine } from "../src/ui/day/earlier";
import { TimelineView } from "../src/ui/day/timeline-view";
import type { Clock } from "../src/ui/day/timeline";
import { createI18n, I18nProvider, type Locale } from "../src/ui/i18n";
import { view } from "./fixtures/desk";
import { budgetThread } from "./fixtures/studio";

process.env.TZ = "Europe/Zurich";
const at = (hhmm: string) => Date.parse(`2026-11-13T${hhmm}:00+01:00`);
const NOW = at("10:00");
const CLOCK: Clock = { now: NOW, evening: at("18:00") };

const meeting = (key: string, from: string, to: string): DeskEvent => ({ key, at: at(from), end: at(to), title: `Meeting ${key}`, kind: "meeting" });
const task = (id: string): TodayTask => ({ task: { id, title: `Task ${id}` }, areaTitle: "Work" });
const done = (key: string, when: string, overrides: Partial<DoneEntry> = {}): DoneEntry => ({
  key,
  title: `Title ${key}`,
  message: `Message ${key}`,
  at: at(when),
  ok: true,
  ...overrides,
});
const closed = (slug: string, day: string, overrides: Partial<StudioThread> = {}): StudioThread => ({
  slug,
  state: "closed",
  closed: day,
  outcome: "decided",
  question: `Question ${slug}?`,
  stand: "Where it stands.",
  notes: [],
  responses: [],
  ...overrides,
});
const studioOf = (threads: StudioThread[]): StudioList => ({ studio: { active: [], closed: threads } });

const texts = (lines: readonly EarlierLine[]) => lines.map((l) => l.text);
const rowTexts = (placed: ReturnType<typeof buildEarlier>) => placed.rows.map(texts);

const render = (v: ReturnType<typeof view>, studio: StudioList | null = null, clock: Clock = CLOCK, locale: Locale = "en") =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <TimelineView view={v} studio={studio} clock={clock} />
    </I18nProvider>,
  );

// Two meetings with free time between them: rows are [meeting a, free 09:00–11:15 now, meeting b, free 12:00–18:00].
const day = [meeting("a", "08:00", "09:00"), meeting("b", "11:15", "12:00")];

describe("what already happened today", () => {
  test("each done entry sits under the meeting or free row whose span contains its time, in time order", () => {
    const placed = buildEarlier(
      view({ today: day, autonomy: { done: [done("d3", "11:30"), done("d1", "08:30"), done("d2", "09:30")] } }),
      null,
      CLOCK,
    );
    expect(rowTexts(placed)).toEqual([["Message d1"], ["Message d2"], ["Message d3"], []]);
    expect(placed.block).toEqual([]);
  });

  test("uses Cortex's message, or the title when the message is empty", () => {
    const placed = buildEarlier(view({ today: day, autonomy: { done: [done("a", "08:30", { message: "" }), done("b", "09:30")] } }), null, CLOCK);
    expect(rowTexts(placed)).toEqual([["Title a"], ["Message b"], [], []]);
  });

  test("a failed entry keeps Cortex's message as it came", () => {
    const message = "The Desk tried to retry it on its own 4 minutes ago. Ranger gave no reason.";
    const placed = buildEarlier(view({ today: day, autonomy: { done: [done("f", "08:30", { ok: false, message, title: "Retry" })] } }), null, CLOCK);
    expect(placed.rows[0]).toEqual([{ key: "done:f", kind: "done", at: at("08:30"), text: message, ok: false }]);
  });

  test("what happened before the first row goes to the block above, in time order", () => {
    const placed = buildEarlier(view({ today: day, autonomy: { done: [done("early", "07:00"), done("late", "07:30"), done("now", "09:30")] } }), null, CLOCK);
    expect(texts(placed.block)).toEqual(["Message early", "Message late"]);
    expect(rowTexts(placed)).toEqual([[], ["Message now"], [], []]);
  });

  test("on a day with no rows every entry goes to the block", () => {
    const placed = buildEarlier(view({ today: [], autonomy: { done: [done("d", "09:00")] } }), null, CLOCK);
    expect(placed.timeline.empty).toBe(true);
    expect(texts(placed.block)).toEqual(["Message d"]);
  });

  test("only today's entries count", () => {
    expect(doneToday([done("yesterday", "09:00", { at: at("09:00") - 24 * 60 * 60 * 1000 })], NOW)).toEqual([]);
    expect(doneToday([done("today", "09:00")], NOW).map((l) => l.text)).toEqual(["Message today"]);
  });

  test("the block lists each win by title, with no time", () => {
    const wins = winsToday(view({ myDay: { items: [], wins: [{ taskId: "t1", title: "Write the report" }, { taskId: "t2", title: "Send the invoice" }] } }));
    expect(wins).toEqual([
      { key: "win:t1", kind: "win", text: "Write the report", ok: true },
      { key: "win:t2", kind: "win", text: "Send the invoice", ok: true },
    ]);
    const placed = buildEarlier(view({ myDay: { items: [task("t")], wins: [{ taskId: "t1", title: "Write the report" }] } }), null, CLOCK);
    expect(placed.block.map((l) => [l.kind, l.at])).toEqual([["win", undefined]]);
  });

  test("the block lists the Studio threads closed today with their question and outcome", () => {
    const studio = studioOf([closed("today", "2026-11-13"), closed("older", "2026-11-12", { outcome: "dropped" })]);
    expect(closedToday(studio, NOW)).toEqual([{ key: "closed:today", kind: "closed", text: "Question today?", ok: true, outcome: "decided" }]);
  });

  test("nothing that happened today leaves the block empty", () => {
    expect(buildEarlier(view({ today: day, myDay: { items: [task("t")] } }), studioOf([closed("older", "2026-11-12")]), CLOCK).block).toEqual([]);
  });
});

describe("the timeline with earlier today", () => {
  const happened = view({
    today: day,
    myDay: { items: [], wins: [{ taskId: "w", title: "Write the report" }] },
    autonomy: { done: [done("before", "07:00"), done("early", "08:30")] },
  });
  const studio = studioOf([closed("budget", "2026-11-13", { question: "What goes into next year's budget?" })]);

  test("shows an Earlier today block at the top with time, message, wins and closed threads", () => {
    const html = render(happened, studio);
    const block = html.slice(html.indexOf('<div class="earlier"'), html.indexOf("Meeting a"));
    expect(block.startsWith('<div class="earlier"')).toBe(true);
    expect(block).toContain('class="eyebrow">Earlier today<');
    expect(block).toContain("07:00 AM");
    expect(block).toContain("Message before");
    expect(block).toContain("<b>Write the report</b>");
    expect(block).toContain("<b>What goes into next year&#x27;s budget?</b>");
    expect(block).toContain("Decided");
    expect(html.indexOf("Earlier today")).toBeLessThan(html.indexOf('class="slot ev'));
  });

  test("the block comes first even on a day with no rows", () => {
    const html = render(view({ autonomy: { done: [done("d", "09:00")] } }), null);
    expect(html.indexOf("Earlier today")).toBeLessThan(html.indexOf("The day has no meetings."));
    expect(html).toContain("Message d");
  });

  test("a line with a failed entry shows Cortex's message unchanged", () => {
    const html = render(view({ autonomy: { done: [done("f", "07:00", { ok: false, message: "Ranger gave no reason." })] } }), null);
    expect(html).toContain("Ranger gave no reason.");
    expect(html).toContain('class="line failed"');
  });

  test("four entries under one row show the three latest, then and 1 more with the rest inside", () => {
    const html = render(
      view({ today: day, autonomy: { done: [done("d1", "09:05"), done("d2", "09:15"), done("d3", "09:25"), done("d4", "09:35")] } }),
      null,
    );
    const [visible, folded] = html.split("<details");
    expect(visible).toContain('class="happened"');
    for (const key of ["d2", "d3", "d4"]) expect(visible).toContain(`Message ${key}`);
    expect(visible).not.toContain("Message d1");
    expect(folded).toContain('<summary>and 1 more</summary>');
    expect(folded).toContain("Message d1");
  });

  test("three entries under one row are shown without a more line", () => {
    const html = render(view({ today: day, autonomy: { done: [done("d1", "09:05"), done("d2", "09:15"), done("d3", "09:25")] } }), null);
    expect(html).not.toContain("<details");
    for (const key of ["d1", "d2", "d3"]) expect(html).toContain(`Message ${key}`);
  });

  test("nothing that happened today leaves the timeline as it was", () => {
    const html = render(view({ today: day, myDay: { items: [] } }), null);
    expect(html).not.toContain("Earlier today");
    expect(html).not.toContain('class="happened"');
    expect(html).toContain("Meeting a");
  });

  test("labels come from the German catalog, Cortex's text stays as sent", () => {
    const html = render(
      view({ today: day, autonomy: { done: [done("early", "07:00"), done("d", "09:05"), done("e", "09:15"), done("f", "09:25"), done("g", "09:35")] } }),
      null,
      CLOCK,
      "de",
    );
    expect(html).toContain("Heute früher");
    expect(html).toContain("07:00");
    expect(html).toContain("und 1 weitere");
    expect(html).toContain("Message g");
    expect(html).toContain("09:05");
  });
});

// The recorded Studio fixture is plain data, so a render through it exercises the shapes Cortex sends.
test("the recorded thread closed today renders with its question", () => {
  const html = render(
    view({ myDay: { items: [], wins: [{ taskId: "t1", title: "Write the report" }] } }),
    studioOf([{ ...budgetThread, state: "closed", closed: "2026-11-13", outcome: "decided" }]),
  );
  expect(html).toContain("Earlier today");
  expect(html).toContain("<b>What goes into next year&#x27;s budget?</b>");
});

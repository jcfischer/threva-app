import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DeskEvent, TodayTask } from "../src/ui/api/types";
import { buildTimeline, type Clock } from "../src/ui/day/timeline";
import { TimelineView } from "../src/ui/day/timeline-view";
import { createI18n, I18nProvider, type Locale } from "../src/ui/i18n";
import { NOW } from "./fixtures/desk";

process.env.TZ = "Europe/Zurich";
const at = (hhmm: string) => Date.parse(`2026-11-13T${hhmm}:00+01:00`);
const CLOCK: Clock = { now: NOW, evening: at("18:00") };

const meeting = (key: string, from: string, to: string): DeskEvent => ({ key, at: at(from), end: at(to), title: `Meeting ${key}`, kind: "meeting" });
const task = (id: string): TodayTask => ({ task: { id, title: `Task ${id}` }, areaTitle: "Work" });

const render = (today: DeskEvent[], tasks: TodayTask[], clock: Clock = CLOCK, locale: Locale = "en") =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <TimelineView today={today} tasks={tasks} clock={clock} />
    </I18nProvider>,
  );

const shape = (today: DeskEvent[], tasks: TodayTask[], clock: Clock = CLOCK) =>
  buildTimeline(today, tasks, clock).rows.map((r) =>
    r.type === "meeting" ? `M ${r.event.key}${r.past ? " past" : ""}${r.now ? " now" : ""}` : `F ${new Date(r.start).toISOString().slice(11, 16)}-${new Date(r.end).toISOString().slice(11, 16)}${r.now ? " now" : ""}${r.tasks.length ? ` tasks:${r.tasks.length}` : ""}`,
  );

describe("buildTimeline", () => {
  test("lists meetings in time order with the free slots between them", () => {
    const today = [meeting("c", "14:00", "15:00"), meeting("a", "08:00", "09:00"), meeting("b", "11:15", "12:00")];
    expect(shape(today, [task("t")])).toEqual([
      "M a past",
      "F 08:00-10:15 now tasks:1",
      "M b",
      "F 11:00-13:00",
      "M c",
      "F 14:00-17:00",
    ]);
  });

  test("a gap shorter than 15 minutes is not shown", () => {
    expect(shape([meeting("a", "10:30", "11:00"), meeting("b", "11:10", "17:30")], [])).toEqual(["F 09:00-09:30 now", "M a", "M b", "F 16:30-17:00"]);
  });

  test("the day runs to the end of the last meeting when that is after 18:00", () => {
    expect(shape([meeting("a", "17:00", "19:00")], [])).toEqual(["F 09:00-16:00 now", "M a"]);
  });

  test("the day starts at the first meeting when that is before now", () => {
    expect(shape([meeting("a", "07:00", "07:30")], [])).toEqual(["M a past", "F 06:30-17:00 now"]);
  });

  test("when now falls inside a meeting, the tasks go to the next free slot", () => {
    expect(shape([meeting("a", "09:30", "10:30"), meeting("b", "10:40", "11:00")], [task("t"), task("u")])).toEqual([
      "M a now",
      "M b",
      "F 10:00-17:00 tasks:2",
    ]);
  });

  test("no meetings and no tasks make an empty day", () => {
    expect(buildTimeline([], [], CLOCK)).toEqual({ allDay: [], rows: [], empty: true });
  });

  test("an all-day event is kept apart from the timed rows", () => {
    const allDay: DeskEvent = { key: "h", at: at("00:00"), title: "Holiday", kind: "all-day" };
    const timeline = buildTimeline([allDay], [], CLOCK);
    expect(timeline.allDay).toEqual([allDay]);
    expect(timeline.rows.map((r) => r.type)).toEqual(["free"]);
  });
});

describe("TimelineView", () => {
  const today = [meeting("past", "08:00", "09:00"), meeting("next", "11:15", "12:00"), { key: "h", at: at("00:00"), title: "Holiday", kind: "all-day" } as DeskEvent];

  test("shows meetings with start, end and title, dims ended ones, and marks now in the free slot with the tasks", () => {
    const html = render(today, [task("t")]);
    expect(html).toContain("Meeting next");
    expect(html).toContain("11:15 AM to 12:00 PM");
    expect(html).toMatch(/class="slot ev past"[^]*Meeting past/);
    expect(html).toContain("Holiday");
    expect(html).toContain("all day");
    expect(html).toContain(">Now<");
    expect(html).toContain("Free until 11:15 AM · 2 h 15 min · 1 h 15 min left");
    expect(html).toContain("Task t");
    expect(html).toContain("Free until 06:00 PM · 6 h");
  });

  test("marks the meeting when now falls inside it", () => {
    const html = render([meeting("on", "09:30", "10:45")], [], { now: NOW, evening: at("18:00") });
    expect(html).toMatch(/class="slot ev cur"[^]*Now[^]*Meeting on[^]*45 min left/);
  });

  test("says the day has no meetings when there is nothing", () => {
    expect(render([], [])).toContain("The day has no meetings.");
    expect(render([], [], CLOCK, "de")).toContain("Heute stehen keine Termine an.");
  });

  test("formats times and lengths for German", () => {
    const html = render(today, [task("t")], CLOCK, "de");
    expect(html).toContain("Frei bis 11:15 · 2 Std. 15 Min. · noch 1 Std. 15 Min.");
    expect(html).toContain(">Jetzt<");
  });
});

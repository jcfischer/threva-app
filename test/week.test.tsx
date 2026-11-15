import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DeskEvent } from "../src/ui/api/types";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { dateInZone, weekColumns } from "../src/ui/week/columns";
import { WeekGrid } from "../src/ui/week/view";
import { view as deskFixture } from "./fixtures/desk";
import { DATE, outlineFixture, row } from "./fixtures/outline";

const en = createI18n("en");
const event = (key: string, date: string, kind: DeskEvent["kind"] = "meeting"): DeskEvent => ({ key, title: key, at: Date.parse(date), kind });

describe("rolling Week", () => {
  test("sorts seven days of structured events in Cortex's timezone with all-day first", () => {
    const desk = deskFixture();
    desk.timeZone = "Europe/Zurich";
    desk.today = [event("late", `${DATE}T18:00:00Z`), event("early", `${DATE}T08:00:00Z`), event("all", `${DATE}T10:00:00Z`, "all-day")];
    desk.ahead = [event("six", "2026-11-19T12:00:00Z"), event("seven", "2026-11-20T12:00:00Z"), event("outside", "2026-11-21T12:00:00Z"), desk.today[0], event("routine", `${DATE}T11:00:00Z`, "agent")];
    const columns = weekColumns(desk, null, DATE, en);
    expect(columns.map(c => c.date)).toEqual([DATE, "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
    expect(columns[0].events.map(e => e.key)).toEqual(["all", "early", "late"]);
    expect(columns[5].events.map(e => e.key)).toEqual(["six"]);
    expect(columns[6].events.map(e => e.key)).toEqual(["seven"]);
    expect(dateInZone(Date.parse("2026-11-14T23:30:00Z"), "Europe/Zurich")).toBe("2026-11-15");
  });

  test("shows every scheduled date, only Cortex's repeat return, and no finished or undated rows", () => {
    const outline = outlineFixture();
    outline.outline.children.push(row("multi", { startDate: DATE, dueDate: "2026-11-20", deferredUntil: "2026-11-15" }));
    const columns = weekColumns(null, outline, DATE, en);
    expect(columns[0].rows.find(item => item.row.id === "multi")?.margin).toBe("starts today");
    expect(columns[1].rows.find(item => item.row.id === "multi")?.margin).toBe("put away until tomorrow");
    expect(columns[6].rows.find(item => item.row.id === "multi")?.margin).toBe("due Fri");
    const rows = columns.flatMap(c => c.rows);
    expect(rows.filter(item => item.row.id === "weekly")).toHaveLength(1);
    expect(columns[4].rows.find(item => item.row.id === "weekly")?.margin).toBe("back Wed · every week");
    expect(rows.some(item => ["plain", "done", "late", "monthly", "starts"].includes(item.row.id))).toBe(false);
    expect(rows.filter(item => item.row.id === "away")).toHaveLength(2);
  });

  test("renders recorded outline metadata and catalog labels in both languages", () => {
    for (const locale of ["en", "de"] as const) {
      const i18n = createI18n(locale);
      const html = renderToStaticMarkup(<I18nProvider value={i18n}><WeekGrid columns={weekColumns(null, outlineFixture(), DATE, i18n)} onOpenRow={() => {}} /></I18nProvider>);
      expect(html.match(/data-week-date=/g)).toHaveLength(7);
      expect(html).toContain(locale === "en" ? "Nothing booked" : "Nichts geplant");
      expect(html).toContain("Write the script");
      expect(html).not.toContain("Book the room");
    }
  });
});

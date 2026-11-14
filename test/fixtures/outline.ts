import type { MyDayOutline, OutlineRow } from "../../src/ui/api/types";
import recorded from "./my-day.json";

export const DATE = "2026-11-14";
export const row = (id: string, extra: Partial<OutlineRow> = {}): OutlineRow => ({ id, title: id, weight: 50, ordering: "parallel", children: [], ...extra });

// Synthetic time scenarios use the root metadata of the recorded my-day.json.
// Tests also render that unmodified dev-stack response separately.
// The richer cases supply recurrence projections as data; Threva computes no rules.
export function outlineFixture(): MyDayOutline {
  return {
    date: DATE, revision: 12,
    outline: { ...recorded.outline, ordering: "parallel", children: [
      row("area:work", { title: "Work", weight: 45, children: [
        row("project", { title: "Exercise", children: [
          row("due", { title: "Write the script", dueDate: DATE }),
          row("away", { title: "Send invitations", deferredUntil: "2026-11-16", startDate: "2026-11-17", dueDate: "2026-11-12" }),
          row("plain", { title: "Book the room" }),
          row("starts", { title: "Debrief", startDate: "2026-11-23" }),
          row("late", { title: "Minutes", dueDate: "2026-11-11" }),
          row("weekly", { title: "Status report", done: true, completedAt: "2026-11-12", repeat: { unit: "week", interval: 1 }, recurrence: { returnsOn: "2026-11-19", reappearsOn: "2026-11-18", finished: false } }),
          row("done", { title: "Arrange the venue", done: true, completedAt: "2026-11-13" }),
        ] }),
        row("monthly", { title: "Quarterly tax", done: true, completedAt: "2026-10-31", repeat: { unit: "month", interval: 3 }, recurrence: { returnsOn: "2027-01-31", reappearsOn: "2027-01-17", finished: false } }),
      ] }),
      row("area:me", { title: "Me", weight: 55, children: [] }),
    ] },
  };
}

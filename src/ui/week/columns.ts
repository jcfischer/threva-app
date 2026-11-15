import type { DeskEvent, DeskView, MyDayOutline, OutlineRow } from "../api/types";
import { relativeDay, rowTime } from "../everything/time";
import type { I18n } from "../i18n";

export interface WeekRow {
  row: OutlineRow;
  margin: string;
}

export interface WeekColumn {
  date: string;
  events: DeskEvent[];
  rows: WeekRow[];
}

export function dateInZone(at: number, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

function datesOf(row: OutlineRow, today: string, i18n: I18n): { date: string; margin: string }[] {
  const rhythm = rowTime({ ...row, done: false, dueDate: undefined, startDate: undefined, deferredUntil: undefined }, today, i18n).margin;
  const margin = (key: "everything.back" | "everything.due" | "everything.starts" | "everything.putAway", date: string) => [i18n.t(key, { date: relativeDay(date, today, i18n) }), rhythm].filter(Boolean).join(" · ");
  const back = row.repeat && !row.recurrence?.finished ? row.recurrence?.reappearsOn : null;
  if (back) return [{ date: back, margin: margin("everything.back", back) }];
  if (row.done) return [];
  const fields = [["dueDate", "everything.due"], ["startDate", "everything.starts"], ["deferredUntil", "everything.putAway"]] as const;
  const dates = fields.flatMap(([field, key]) => {
    const date = row[field];
    return date ? [{ date, margin: margin(key, date) }] : [];
  });
  return row.repeat ? dates.slice(0, 1) : dates;
}

export function weekColumns(desk: DeskView | null, outline: MyDayOutline | null, today: string, i18n: I18n): WeekColumn[] {
  const start = Date.parse(`${today}T12:00:00Z`);
  const columns: WeekColumn[] = Array.from({ length: 7 }, (_, n) => ({ date: new Date(start + n * 86_400_000).toISOString().slice(0, 10), events: [], rows: [] }));
  const byDate = new Map(columns.map(column => [column.date, column]));
  const seen = new Set<string>();
  for (const event of [...(desk?.today ?? []), ...(desk?.ahead ?? [])]) {
    if (seen.has(event.key)) continue;
    seen.add(event.key);
    if (!["meeting", "all-day", "reminder"].includes(event.kind)) continue;
    byDate.get(dateInZone(event.at, desk?.timeZone))?.events.push(event);
  }
  for (const column of columns) column.events.sort((a, b) => Number(b.kind === "all-day") - Number(a.kind === "all-day") || a.at - b.at);
  const visit = (row: OutlineRow) => {
    for (const { date, margin } of datesOf(row, today, i18n)) {
      const column = byDate.get(date);
      if (!column) continue;
      const existing = column.rows.find(item => item.row.id === row.id);
      if (existing) existing.margin = `${existing.margin} · ${margin}`;
      else column.rows.push({ row, margin });
    }
    row.children.forEach(visit);
  };
  outline?.outline.children.forEach(visit);
  return columns;
}

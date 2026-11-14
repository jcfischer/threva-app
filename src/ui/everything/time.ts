import type { OutlineRow } from "../api/types";
import { createI18n, type I18n } from "../i18n";

export interface RowTime {
  state: "open" | "later" | "done";
  margin: string;
  warning: boolean;
  back?: string;
}

const dayDate = (date: string) => new Date(`${date}T12:00:00Z`);

export function relativeDay(date: string, today: string, i18n: I18n): string {
  const days = Math.round((dayDate(date).getTime() - dayDate(today).getTime()) / 86_400_000);
  if (days === 0) return i18n.t("everything.today");
  if (days === 1) return i18n.t("everything.tomorrow");
  if (days === -1) return i18n.t("everything.yesterday");
  const value = new Intl.DateTimeFormat(i18n.locale, { timeZone: "UTC", ...(Math.abs(days) < 7 ? { weekday: "short" } : { day: "numeric", month: "short", ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) }) }).format(dayDate(date));
  return days < -1 && days > -7 ? i18n.t("everything.lastDay", { day: value }) : value;
}

function rhythm(repeat: NonNullable<OutlineRow["repeat"]>, i18n: I18n): string {
  const keys = { day: "everything.everyDays", week: "everything.everyWeeks", month: "everything.everyMonths" } as const;
  let text = i18n.tn(keys[repeat.unit], repeat.interval);
  if (repeat.unit === "week" && repeat.weekdays?.length) {
    const days = repeat.weekdays.map(day => new Intl.DateTimeFormat(i18n.locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 15 + day))));
    text = i18n.t("everything.onDays", { rhythm: text, days: new Intl.ListFormat(i18n.locale).format(days) });
  }
  return text;
}

/** Display only: return dates are supplied by Cortex, never calculated here. */
export function rowTime(row: OutlineRow, today: string, i18n: I18n = createI18n("en")): RowTime {
  const beat = row.repeat ? rhythm(row.repeat, i18n) : "";
  const withBeat = (text: string) => [text, beat].filter(Boolean).join(" · ");
  const result = (state: RowTime["state"], margin: string, back?: string, warning = false): RowTime => ({ state, margin: withBeat(margin), warning, ...(back ? { back } : {}) });
  const date = (iso: string) => relativeDay(iso, today, i18n);
  if (row.done) {
    const done = row.completedAt ? i18n.t("everything.doneOn", { date: date(row.completedAt) }) : i18n.t("everything.done");
    const back = row.recurrence?.reappearsOn ?? undefined;
    return result(row.repeat ? "later" : "done", back ? `${done} · ${i18n.t("everything.back", { date: date(back) })}` : done, back);
  }
  if (row.deferredUntil && row.deferredUntil > today) return result("later", i18n.t("everything.putAway", { date: date(row.deferredUntil) }), row.deferredUntil);
  if (row.startDate && row.startDate > today) return result("later", i18n.t("everything.starts", { date: date(row.startDate) }), row.startDate);
  const late = row.dueDate !== undefined && row.dueDate < today;
  return result("open", row.dueDate ? i18n.t(late ? "everything.wasDue" : "everything.due", { date: date(row.dueDate) }) : "", undefined, late);
}

export function rowCounts(row: OutlineRow, today: string): { open: number; later: number; back?: string } {
  if (!row.children.length) {
    const time = rowTime(row, today);
    return { open: Number(time.state === "open"), later: Number(time.state === "later"), back: time.back };
  }
  const counts = row.children.map(child => rowCounts(child, today));
  return {
    open: counts.reduce((n, c) => n + c.open, 0),
    later: counts.reduce((n, c) => n + c.later, 0),
    back: counts.flatMap(c => c.back ? [c.back] : []).sort()[0],
  };
}

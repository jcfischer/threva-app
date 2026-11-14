import type { OutlineRow, StudioProject } from "../api/types";
import { createI18n, type I18n } from "../i18n";

export interface RowTime {
  state: "open" | "later" | "done";
  margin: string;
  warning: boolean;
  back?: string;
}

type RowState =
  | { kind: "done"; state: "done" | "later"; back?: string }
  | { kind: "away" | "starts"; state: "later"; back: string }
  | { kind: "open"; state: "open"; back?: never };

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

/** Classify without formatting; return dates are supplied by Cortex. */
export function rowState(row: OutlineRow, today: string): RowState {
  if (row.done) {
    if (!row.repeat || row.recurrence?.finished) return { kind: "done", state: "done" };
    return { kind: "done", state: "later", back: row.recurrence?.reappearsOn ?? undefined };
  }
  if (row.deferredUntil && row.deferredUntil > today) return { kind: "away", state: "later", back: row.deferredUntil };
  if (row.startDate && row.startDate > today) return { kind: "starts", state: "later", back: row.startDate };
  return { kind: "open", state: "open" };
}

/** Display only: return dates are supplied by Cortex, never calculated here. */
export function rowTime(row: OutlineRow, today: string, i18n: I18n = createI18n("en")): RowTime {
  const classification = rowState(row, today);
  const { state, back } = classification;
  const beat = row.repeat ? rhythm(row.repeat, i18n) : "";
  const withBeat = (text: string) => [text, beat].filter(Boolean).join(" · ");
  const result = (margin: string, warning = false): RowTime => ({ state, margin: withBeat(margin), warning, ...(back ? { back } : {}) });
  const date = (iso: string) => relativeDay(iso, today, i18n);
  switch (classification.kind) {
    case "done": {
      const done = row.completedAt ? i18n.t("everything.doneOn", { date: date(row.completedAt) }) : i18n.t("everything.done");
      return result(back ? `${done} · ${i18n.t("everything.back", { date: date(back) })}` : done);
    }
    case "away":
      return result(i18n.t("everything.putAway", { date: date(classification.back) }));
    case "starts":
      return result(i18n.t("everything.starts", { date: date(classification.back) }));
    case "open": {
      const late = row.dueDate !== undefined && row.dueDate < today;
      return result(row.dueDate ? i18n.t(late ? "everything.wasDue" : "everything.due", { date: date(row.dueDate) }) : "", late);
    }
  }
}

export function projectRowState(project: StudioProject): RowTime["state"] {
  return project.state === "closed" ? "done" : project.state === "parked" ? "later" : "open";
}

export function rowCounts(row: OutlineRow, today: string, projects: readonly StudioProject[] = []): { open: number; later: number; back?: string } {
  const project = projects.find(project => project.id === row.id);
  if (project) {
    const state = projectRowState(project);
    return { open: Number(state === "open"), later: Number(state === "later") };
  }
  if (!row.children.length) {
    const time = rowState(row, today);
    return { open: Number(time.state === "open"), later: Number(time.state === "later"), back: time.back };
  }
  const counts = row.children.map(child => rowCounts(child, today, projects));
  return {
    open: counts.reduce((n, c) => n + c.open, 0),
    later: counts.reduce((n, c) => n + c.later, 0),
    back: counts.flatMap(c => c.back ? [c.back] : []).sort()[0],
  };
}

import type { DeskEvent, TodayTask } from "../api/types";

export const MIN_FREE_MS = 15 * 60 * 1000;
export const EVENING_HOUR = 18;

export type TimelineRow =
  | { type: "meeting"; event: DeskEvent; start: number; end: number; past: boolean; now: boolean }
  | { type: "free"; start: number; end: number; now: boolean; tasks: TodayTask[] };

export interface Timeline {
  allDay: DeskEvent[];
  rows: TimelineRow[];
  unplaced: TodayTask[];
  empty: boolean;
}

export interface Clock {
  now: number;
  evening: number;
}

export function eveningOf(now: number): number {
  const d = new Date(now);
  d.setHours(EVENING_HOUR, 0, 0, 0);
  return d.getTime();
}

export function clockAt(now: number): Clock {
  return { now, evening: eveningOf(now) };
}

type Timed = DeskEvent & { end: number };

const isTimed = (e: DeskEvent): e is Timed => e.kind === "meeting" && e.end !== undefined && e.end > e.at;

export function buildTimeline(today: readonly DeskEvent[], tasks: readonly TodayTask[], clock: Clock): Timeline {
  const { now, evening } = clock;
  const allDay = today.filter((e) => e.kind === "all-day");
  const timed = today.filter(isTimed).sort((a, b) => a.at - b.at || a.end - b.end);
  if (timed.length === 0 && allDay.length === 0 && tasks.length === 0) return { allDay, rows: [], unplaced: [], empty: true };

  const dayStart = Math.min(now, timed[0]?.at ?? now);
  const dayEnd = Math.max(evening, ...timed.map((e) => e.end));
  const rows: TimelineRow[] = [];
  const free = (start: number, end: number) => {
    if (end - start >= MIN_FREE_MS) rows.push({ type: "free", start, end, now: start <= now && now < end, tasks: [] });
  };

  let cursor = dayStart;
  for (const event of timed) {
    free(cursor, event.at);
    rows.push({ type: "meeting", event, start: event.at, end: event.end, past: event.end <= now, now: event.at <= now && now < event.end });
    cursor = Math.max(cursor, event.end);
  }
  free(cursor, dayEnd);

  const home = rows.find((r) => r.type === "free" && r.now) ?? rows.find((r) => r.type === "free" && r.start > now);
  if (home?.type === "free") home.tasks = [...tasks];
  const unplaced = home?.type === "free" ? [] : [...tasks];
  return { allDay, rows, unplaced, empty: rows.length === 0 && allDay.length === 0 };
}

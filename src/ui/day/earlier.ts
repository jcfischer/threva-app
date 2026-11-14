import type { DeskView, DoneEntry, StudioList, StudioOutcome } from "../api/types";
import { buildTimeline, type Clock, type Timeline } from "./timeline";

// What already happened today: what the Desk did for you, the tasks the day is done with and the Studio threads closed
// today. Every line carries Cortex's own words; only the labels around them come from the catalog.

export interface EarlierLine {
  key: string;
  kind: "done" | "win" | "closed";
  at?: number;
  text: string;
  ok: boolean;
  outcome?: StudioOutcome;
}

export interface Earlier {
  timeline: Timeline;
  // The lines under each row of `timeline.rows`, in the same order and of the same length.
  rows: EarlierLine[][];
  // "Earlier today": what happened before the first row, plus the wins and the threads closed today.
  block: EarlierLine[];
}

function dayBounds(now: number): { start: number; end: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** The local calendar date as Cortex writes a Studio `closed` date, `YYYY-MM-DD`. */
export function localDate(now: number): string {
  const d = new Date(now);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function doneToday(done: readonly DoneEntry[], now: number): EarlierLine[] {
  const { start, end } = dayBounds(now);
  return done
    .filter((d) => d.at >= start && d.at < end)
    .sort((a, b) => a.at - b.at || a.key.localeCompare(b.key))
    .map((d) => ({ key: `done:${d.key}`, kind: "done", at: d.at, text: d.message || d.title, ok: d.ok }));
}

export function winsToday(view: DeskView): EarlierLine[] {
  return (view.myDay?.wins ?? []).map((w) => ({ key: `win:${w.taskId}`, kind: "win", text: w.title, ok: true }));
}

export function closedToday(studio: StudioList | null, now: number): EarlierLine[] {
  const today = localDate(now);
  return (studio?.studio?.closed ?? [])
    .filter((t) => t.closed === today)
    .map((t) => ({ key: `closed:${t.slug}`, kind: "closed", text: t.question, ok: true, ...(t.outcome ? { outcome: t.outcome } : {}) }));
}

export function buildEarlier(view: DeskView, studio: StudioList | null, clock: Clock): Earlier {
  const timeline = buildTimeline(view.today, view.myDay?.items ?? [], clock);
  const rows: EarlierLine[][] = timeline.rows.map(() => []);
  const before: EarlierLine[] = [];
  for (const line of doneToday(view.autonomy?.done ?? [], clock.now)) {
    const at = line.at ?? clock.now;
    const index = timeline.rows.findIndex((r) => r.start <= at && at < r.end);
    if (index === -1) before.push(line);
    else rows[index]?.push(line);
  }
  return { timeline, rows, block: [...before, ...winsToday(view), ...closedToday(studio, clock.now)] };
}

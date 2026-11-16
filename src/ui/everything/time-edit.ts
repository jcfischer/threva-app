import type { OutlineDetails, OutlineRepeat, OutlineRow } from "../api/types";
import { detailsOf } from "./note";

export type RepeatMode = "calendar" | "completion";
export type RepeatUnit = OutlineRepeat["unit"];

export interface RepeatDraft {
  mode: RepeatMode;
  unit: RepeatUnit;
  interval: number;
  weekdays: number[];
}

export interface TimeDraft {
  start: string;
  away: string;
  repeat: RepeatDraft | null;
}

export const NEW_REPEAT: RepeatDraft = { mode: "calendar", unit: "week", interval: 1, weekdays: [] };

const sorted = (days: readonly number[]) => [...days].sort((a, b) => a - b);

/** The fields as the row shows them now. An existing repeat that carries no mode keeps completion counting. */
export function draftOf(row: OutlineRow): TimeDraft {
  const repeat = row.repeat;
  return {
    start: row.startDate ?? "",
    away: row.deferredUntil ?? "",
    repeat: repeat ? { mode: repeat.mode ?? "completion", unit: repeat.unit, interval: repeat.interval, weekdays: sorted(repeat.weekdays ?? []) } : null,
  };
}

function sameRepeat(a: RepeatDraft | null, b: RepeatDraft | null): boolean {
  if (!a || !b) return a === b;
  return a.mode === b.mode && a.unit === b.unit && a.interval === b.interval && a.weekdays.join() === b.weekdays.join();
}

export function isChanged(row: OutlineRow, draft: TimeDraft): boolean {
  const now = draftOf(row);
  return now.start !== draft.start || now.away !== draft.away || !sameRepeat(now.repeat, draft.repeat);
}

/** The whole repeat object: the edited rhythm and rule, with `count` and `until` exactly as Cortex returned them. */
export function repeatBody(row: OutlineRow, draft: RepeatDraft): NonNullable<OutlineDetails["repeat"]> {
  const kept = row.repeat;
  return {
    mode: draft.mode,
    unit: draft.unit,
    interval: draft.interval,
    ...(draft.unit === "week" && draft.weekdays.length ? { weekdays: sorted(draft.weekdays) } : {}),
    ...(kept?.count !== undefined ? { count: kept.count } : {}),
    ...(kept?.until !== undefined ? { until: kept.until } : {}),
  };
}

/** The row's own details plus only the time fields that changed: a cleared date is "", a cleared repeat is null, an untouched field is left out. */
export function timeDetails(row: OutlineRow, date: string, draft: TimeDraft, note: string = row.note ?? ""): OutlineDetails {
  const now = draftOf(row);
  return {
    ...detailsOf(row, date, note),
    ...(draft.start !== now.start ? { startDate: draft.start } : {}),
    ...(draft.away !== now.away ? { deferredUntil: draft.away } : {}),
    ...(sameRepeat(now.repeat, draft.repeat) ? {} : { repeat: draft.repeat ? repeatBody(row, draft.repeat) : null }),
  };
}

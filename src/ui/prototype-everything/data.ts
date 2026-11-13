// PROTOTYPE for threva-app#47. Throwaway: no tests, no catalog strings, state in memory.
// The row shape follows Cortex's OutlineNode (src/balance/core/types.ts). `who` and `log`
// are prototype-only: Cortex does not return them on a node today.

export interface Repeat {
  unit: "day" | "week" | "month";
  interval: number;
  weekdays?: number[];
  timesDone?: number;
}

export interface Row {
  id: string;
  title: string;
  weight: number;
  children: Row[];
  done?: boolean;
  completedAt?: string;
  dueDate?: string;
  leadDays?: number;
  startDate?: string;
  deferredUntil?: string;
  focusMonth?: string;
  repeat?: Repeat;
  who?: "routine";
  log?: string[];
  got?: number;
}

export type Lens = "now" | "later" | "done";

const DAY = 86_400_000;
export const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const shift = (date: string, days: number) => iso(Date.parse(date + "T00:00:00Z") + days * DAY);
export const between = (from: string, to: string) => Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY);
const weekday = (date: string) => new Date(date + "T00:00:00Z").getUTCDay();

function addMonths(date: string, months: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(d, new Date(Date.UTC(year, month, 0)).getUTCDate());
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Same rule as Cortex's nextOccurrence (src/balance/core/recur.ts).
export function nextOccurrence(after: string, repeat: Repeat): string {
  const interval = Math.max(1, repeat.interval);
  if (repeat.unit === "day") return shift(after, interval);
  if (repeat.unit === "week") {
    if (repeat.weekdays?.length) for (let i = 1; i <= 7; i++) if (repeat.weekdays.includes(weekday(shift(after, i)))) return shift(after, i);
    return shift(after, 7 * interval);
  }
  return addMonths(after, interval);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function day(date: string, today: string): string {
  const n = between(today, date);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (Math.abs(n) < 7) return `${n < 0 ? "last " : ""}${DAYS[weekday(date)]}`;
  return `${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

export function rhythm(r: Repeat): string {
  const unit = r.interval === 1 ? r.unit : `${r.interval} ${r.unit}s`;
  const on = r.unit === "week" && r.weekdays?.length ? ` on ${r.weekdays.map((d) => DAYS[d]).join(", ")}` : "";
  return `every ${unit}${on}`;
}

export interface Time {
  lens: Lens;
  margin: string;
  back?: string;
  late?: boolean;
}

export function timeOf(row: Row, today: string): Time {
  const beat = row.repeat ? rhythm(row.repeat) : "";
  if (row.done && row.repeat && row.completedAt) {
    const next = nextOccurrence(row.completedAt, row.repeat);
    return { lens: "later", back: next, margin: `done ${day(row.completedAt, today)} · back ${day(shift(next, -(row.leadDays ?? 0)), today)} · ${beat}` };
  }
  if (row.done) return { lens: "done", margin: `done ${row.completedAt ? day(row.completedAt, today) : ""}` };
  if (row.deferredUntil && row.deferredUntil > today) return { lens: "later", back: row.deferredUntil, margin: `put away until ${day(row.deferredUntil, today)}` };
  if (row.startDate && row.startDate > today) return { lens: "later", back: row.startDate, margin: `starts ${day(row.startDate, today)}` };
  const late = row.dueDate !== undefined && row.dueDate < today;
  const due = row.dueDate ? (late ? `was due ${day(row.dueDate, today)}` : `due ${day(row.dueDate, today)}`) : "";
  return { lens: "now", late, margin: [due, beat].filter(Boolean).join(" · ") || "no date" };
}

export const leaves = (row: Row): Row[] => (row.children.length ? row.children.flatMap(leaves) : [row]);

export function counts(row: Row, today: string): Record<Lens, number> {
  const c = { now: 0, later: 0, done: 0 };
  for (const leaf of leaves(row)) c[timeOf(leaf, today).lens]++;
  return c;
}

export function patch(row: Row, id: string, change: (r: Row) => Row): Row {
  if (row.id === id) return change(row);
  return { ...row, children: row.children.map((c) => patch(c, id, change)) };
}

export function find(row: Row, id: string): Row | null {
  if (row.id === id) return row;
  for (const c of row.children) {
    const hit = find(c, id);
    if (hit) return hit;
  }
  return null;
}

export function pathTo(row: Row, id: string, trail: Row[] = []): Row[] | null {
  if (row.id === id) return [...trail, row];
  for (const c of row.children) {
    const hit = pathTo(c, id, [...trail, row]);
    if (hit) return hit;
  }
  return null;
}

export function complete(row: Row, today: string): Row {
  const repeat = row.repeat ? { ...row.repeat, timesDone: (row.repeat.timesDone ?? 0) + 1 } : undefined;
  return { ...row, done: true, completedAt: today, log: [...(row.log ?? []), today], ...(repeat ? { repeat } : {}) };
}

let seq = 0;
const leaf = (title: string, extra: Partial<Row> = {}): Row => ({ id: `r${seq++}`, title, weight: 50, children: [], ...extra });
const group = (title: string, children: Row[], extra: Partial<Row> = {}): Row => ({ id: `g${seq++}`, title, weight: 50, children, ...extra });

export function fixture(today: string): Row {
  seq = 0;
  const d = (n: number) => shift(today, n);
  const back = (step: number, n: number, from = 0) => Array.from({ length: n }, (_, i) => d(from - step * (n - i)));
  const dow = (n: number) => weekday(d(n));
  return group("Everything", [
    group("Clients", [
      group("Crisis exercise", [
        leaf("Decide who plays the press", { dueDate: d(0) }),
        leaf("Write the incident script", { dueDate: d(3) }),
        leaf("Send the invitation to the board", { deferredUntil: d(2) }),
        leaf("Book the meeting room", { done: true, completedAt: d(-1) }),
        leaf("Debrief with Sara", { startDate: d(9) }),
      ], { focusMonth: today.slice(0, 7) }),
      group("Council project", [
        leaf("Export the slides for Thursday", { dueDate: d(1) }),
        leaf("Send the weekly status report", { repeat: { unit: "week", interval: 1, weekdays: [dow(-2)], timesDone: 14 }, done: true, completedAt: d(-2), log: back(7, 5, 5) }),
        leaf("Write the steering committee minutes", { dueDate: d(-3) }),
      ]),
      group("Requests", [leaf("Answer the business association", { dueDate: d(2) })]),
    ], { weight: 45, got: 58 }),
    group("Teaching", [
      group("Evening course", [
        leaf("Prepare this week's session", { repeat: { unit: "week", interval: 1, weekdays: [dow(3)], timesDone: 9 }, dueDate: d(3), log: back(7, 4, 3) }),
        leaf("Grade the exercises", { repeat: { unit: "week", interval: 2, timesDone: 4 }, done: true, completedAt: d(-5), log: [d(-33), d(-19)] }),
        leaf("Set the exam date with the course office", { dueDate: d(16) }),
      ]),
      group("Weekly article", [
        leaf("Write the article", { repeat: { unit: "week", interval: 1, weekdays: [dow(5)], timesDone: 31 }, dueDate: d(5), log: [d(-23), d(-9), d(-2)] }),
        leaf("Collect topic ideas from the advisories", { who: "routine", repeat: { unit: "week", interval: 1, weekdays: [dow(2)] }, dueDate: d(2), log: back(7, 3, 2) }),
      ]),
    ], { weight: 25, got: 30 }),
    group("Me", [
      group("Health", [
        leaf("Book the dentist appointment"),
        leaf("Go for a run", { repeat: { unit: "day", interval: 2, timesDone: 22 }, done: true, completedAt: d(-1), log: [d(-7), d(-5), d(-3)] }),
      ]),
      group("Training", [
        leaf("Decide on the certification", { dueDate: d(3) }),
        leaf("Read the course outline", { done: true, completedAt: d(-6) }),
      ]),
      leaf("Pay the quarterly tax", { repeat: { unit: "month", interval: 3, timesDone: 6 }, leadDays: 14, done: true, completedAt: d(-20), log: [] }),
    ], { weight: 30, got: 12 }),
  ]);
}

export function localToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

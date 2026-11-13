import type { DeskEvent, DeskItem, DeskItemKind, DeskView, MailSweep, StudioList, StudioThread, TodayTask } from "../api/types";

export type Entry =
  | { k: string; type: "agent"; item: DeskItem }
  | { k: string; type: "thread"; thread: StudioThread }
  | { k: string; type: "item"; item: DeskItem; fresh: boolean }
  | { k: string; type: "task"; task: TodayTask }
  | { k: string; type: "mail"; item: DeskItem }
  | { k: string; type: "sweep"; sweep: MailSweep }
  | { k: string; type: "soon"; item: DeskItem; event: DeskEvent | null }
  | { k: string; type: "after"; event: DeskEvent };

export const AFTER_WINDOW_MS = 60 * 60 * 1000;

export interface Session {
  readonly skip: readonly string[];
  readonly pin: string | null;
}

export const EMPTY_SESSION: Session = { skip: [], pin: null };

const AGENT_KINDS: ReadonlySet<DeskItemKind> = new Set(["agent-blocked", "decision", "grilling", "escalation", "agent-failed"]);

const DAY = 24 * 60 * 60 * 1000;

export function isMailItem(item: DeskItem): boolean {
  return item.kind === "mail";
}

export function isMeetingItem(item: DeskItem): boolean {
  return item.kind === "meeting";
}

export function endedMeetings(view: DeskView, now: number, dismissed: readonly string[]): DeskEvent[] {
  return view.today
    .filter((e) => e.kind === "meeting" && e.end !== undefined && e.end <= now && now - e.end < AFTER_WINDOW_MS && !dismissed.includes(e.key))
    .sort((a, b) => (b.end ?? 0) - (a.end ?? 0));
}

export function isAgentItem(item: DeskItem): boolean {
  return AGENT_KINDS.has(item.kind);
}

export function threadWaits(thread: StudioThread): boolean {
  const latest = thread.notes.reduce<StudioThread["notes"][number] | null>(
    (last, note) => (!last || Date.parse(note.at) >= Date.parse(last.at) ? note : last),
    null,
  );
  if (!latest || latest.status !== "open") return false;
  const noteAt = Date.parse(latest.at);
  return !thread.responses.some((r) => Date.parse(r.at) >= noteAt);
}

export function buildQueue(view: DeskView, studio: StudioList | null, session: Session, now: number, dismissed: readonly string[] = []): Entry[] {
  const items = [...view.items].sort((a, b) => b.score - a.score);
  const isFresh = (item: DeskItem) => item.since !== undefined && now - item.since < DAY;
  const eventFor = (item: DeskItem) => view.today.find((e) => e.key === item.eventKey) ?? null;
  const other = (i: DeskItem) => !isAgentItem(i) && !isMailItem(i) && !isMeetingItem(i);

  const queue: Entry[] = [
    ...items.filter(isMeetingItem).map((item): Entry => ({ k: `i:${item.key}`, type: "soon", item, event: eventFor(item) })),
    ...endedMeetings(view, now, dismissed).map((event): Entry => ({ k: `a:${event.key}`, type: "after", event })),
    ...items.filter(isAgentItem).map((item): Entry => ({ k: `i:${item.key}`, type: "agent", item })),
    ...[...(view.mailSweeps ?? []), ...(view.mailDigests ?? [])].map((sweep): Entry => ({ k: `s:${sweep.id}`, type: "sweep", sweep })),
    ...items.filter(isMailItem).map((item): Entry => ({ k: `i:${item.key}`, type: "mail", item })),
    ...(studio?.studio?.active ?? []).filter(threadWaits).map((thread): Entry => ({ k: `t:${thread.slug}`, type: "thread", thread })),
    ...items.filter((i) => other(i) && isFresh(i)).map((item): Entry => ({ k: `i:${item.key}`, type: "item", item, fresh: true })),
    ...items.filter((i) => other(i) && !isFresh(i)).map((item): Entry => ({ k: `i:${item.key}`, type: "item", item, fresh: false })),
    ...(view.myDay?.items ?? []).map((task): Entry => ({ k: `d:${task.task.id}`, type: "task", task })),
  ];

  return applySession(queue, session);
}

export function applySession(queue: readonly Entry[], session: Session): Entry[] {
  const skipped = session.skip.flatMap((k) => queue.filter((e) => e.k === k));
  const ordered = [...queue.filter((e) => !session.skip.includes(e.k)), ...skipped];
  const pin = ordered.findIndex((e) => e.k === session.pin);
  if (pin > 0) ordered.unshift(...ordered.splice(pin, 1));
  return ordered;
}

export function skip(session: Session, k: string): Session {
  return { skip: [...session.skip.filter((s) => s !== k), k], pin: session.pin === k ? null : session.pin };
}

export function pin(session: Session, k: string): Session {
  return { skip: session.skip.filter((s) => s !== k), pin: session.pin === k ? null : k };
}

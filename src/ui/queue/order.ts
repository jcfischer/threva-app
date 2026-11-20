import type { DeskEvent, DeskItem, DeskItemKind, DeskView, MailSweep, StudioList, StudioThread, TodayTask } from "@desk/types";
import { isRuleOffer } from "../arrivals/outcomes";

export type Entry =
  | { k: string; type: "agent"; item: DeskItem }
  | { k: string; type: "thread"; thread: StudioThread; waits: boolean }
  | { k: string; type: "item"; item: DeskItem; fresh: boolean }
  | { k: string; type: "task"; task: TodayTask }
  | { k: string; type: "mail"; item: DeskItem; learning: boolean }
  | { k: string; type: "rule"; item: DeskItem }
  | { k: string; type: "sweep"; sweep: MailSweep }
  | { k: string; type: "soon"; item: DeskItem; event: DeskEvent | null }
  | { k: string; type: "after"; item: DeskItem };

export interface Session {
  readonly skip: readonly string[];
  readonly pin: string | null;
}

export const EMPTY_SESSION: Session = { skip: [], pin: null };

export function isInterrupting(item: DeskItem): boolean {
  return item.interrupt?.reason !== undefined && item.interrupt.delivery !== "held";
}

const AGENT_KINDS: ReadonlySet<DeskItemKind> = new Set(["agent-blocked", "decision", "grilling", "escalation", "agent-failed"]);

const DAY = 24 * 60 * 60 * 1000;

export function isMailItem(item: DeskItem): boolean {
  return item.kind === "mail";
}

export function isMeetingItem(item: DeskItem): boolean {
  return item.kind === "meeting";
}

export function isAfterMeetingItem(item: DeskItem): boolean {
  return item.kind === "meeting-after";
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

export function buildQueue(
  view: DeskView,
  studio: StudioList | null,
  session: Session,
  now: number,
): Entry[] {
  const items = [...view.items].sort((a, b) => b.score - a.score);
  const isFresh = (item: DeskItem) => item.since !== undefined && now - item.since < DAY;
  const eventFor = (item: DeskItem) => view.today.find((e) => e.key === item.eventKey) ?? null;
  const other = (i: DeskItem) => !isAgentItem(i) && !isMailItem(i) && !isMeetingItem(i) && !isAfterMeetingItem(i) && !isRuleOffer(i);
  const learning = view.mailLearning === true;

  const queue: Entry[] = [
    ...items.filter(isMeetingItem).map((item): Entry => ({ k: `i:${item.key}`, type: "soon", item, event: eventFor(item) })),
    ...items.filter(isAfterMeetingItem).map((item): Entry => ({ k: `i:${item.key}`, type: "after", item })),
    ...items.filter(isAgentItem).map((item): Entry => ({ k: `i:${item.key}`, type: "agent", item })),
    ...[...(view.mailSweeps ?? []), ...(view.mailDigests ?? [])].map((sweep): Entry => ({ k: `s:${sweep.id}`, type: "sweep", sweep })),
    ...items.filter(isMailItem).map((item): Entry => ({ k: `i:${item.key}`, type: "mail", item, learning })),
    ...items.filter(isRuleOffer).map((item): Entry => ({ k: `i:${item.key}`, type: "rule", item })),
    ...(studio?.studio?.active ?? []).filter(threadWaits).map((thread): Entry => ({ k: `t:${thread.slug}`, type: "thread", thread, waits: true })),
    ...items.filter((i) => other(i) && isFresh(i)).map((item): Entry => ({ k: `i:${item.key}`, type: "item", item, fresh: true })),
    ...items.filter((i) => other(i) && !isFresh(i)).map((item): Entry => ({ k: `i:${item.key}`, type: "item", item, fresh: false })),
    ...(view.myDay?.items ?? []).map((task): Entry => ({ k: `d:${task.task.id}`, type: "task", task })),
  ];

  return promoteInterruptions(applySession(queue, session), view.items, session.pin);
}

function promoteInterruptions(ordered: readonly Entry[], items: readonly DeskItem[], pin: string | null): Entry[] {
  const byKey = new Map(ordered.map(entry => [entry.k, entry]));
  const urgent = items.filter(isInterrupting).flatMap(item => {
    const entry = byKey.get(`i:${item.key}`);
    return entry ? [entry] : [];
  });
  const selected = urgent.findIndex(entry => entry.k === pin);
  if (selected > 0) urgent.unshift(...urgent.splice(selected, 1));
  const urgentKeys = new Set(urgent.map(entry => entry.k));
  return [...urgent, ...ordered.filter(entry => !urgentKeys.has(entry.k))];
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
  return { ...session, skip: session.skip.filter((s) => s !== k), pin: session.pin === k ? null : k };
}

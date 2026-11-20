import type { InterruptReason, MailSweep } from "@desk/types";
import type { TextKey } from "../i18n";
import type { Entry } from "./order";

export const THEN_TITLES = 3;

const REASON_MESSAGES = new Map<string, TextKey>([
  ["meeting.soon", "interrupt.reason.meetingSoon"],
  ["reminder.due", "interrupt.reason.reminderDue"],
  ["mail.meeting-today", "interrupt.reason.meetingToday"],
  ["mail.deadline-today", "interrupt.reason.deadlineToday"],
  ["mail.vip", "interrupt.reason.vip"],
  ["mail.ranked", "interrupt.reason.ranked"],
]);

export function interruptionReasonMessage(code: string): TextKey | undefined {
  return REASON_MESSAGES.get(code);
}

export type WhyNow =
  | { kind: "cortex"; text: string }
  | { kind: "interrupt"; reason: InterruptReason; text: string }
  | { kind: "thread" }
  | { kind: "task" };

export interface SweepLink {
  k: string;
  group: Pick<MailSweep, "kind" | "basis" | "labelPhrase">;
  count: number;
  archive: boolean;
}

export interface ThenLine {
  titles: { k: string; title: string }[];
  more: number;
  sweeps: SweepLink[];
}

export interface Around {
  why: WhyNow | null;
  then: ThenLine | null;
}

export function whyNow(entry: Entry): WhyNow | null {
  switch (entry.type) {
    case "agent":
    case "item":
    case "mail":
    case "rule":
    case "soon":
    case "after":
      if (entry.item.interrupt?.reason) {
        const reason = entry.item.interrupt.reason;
        if (!interruptionReasonMessage(reason.code) && !entry.item.why) return null;
        return { kind: "interrupt", reason, text: entry.item.why };
      }
      return entry.item.why ? { kind: "cortex", text: entry.item.why } : null;
    case "sweep":
      return entry.sweep.why ? { kind: "cortex", text: entry.sweep.why } : null;
    case "thread":
      return entry.waits ? { kind: "thread" } : null;
    case "task":
      return { kind: "task" };
  }
}

export function entryTitle(entry: Entry): string {
  switch (entry.type) {
    case "agent":
    case "item":
    case "mail":
    case "rule":
    case "soon":
    case "after":
      return entry.item.title;
    case "sweep":
      return entry.sweep.title;
    case "thread":
      return entry.thread.question;
    case "task":
      return entry.task.task.title;
  }
}

export function around(queue: readonly Entry[]): Around {
  const [first, ...rest] = queue;
  if (!first) return { why: null, then: null };
  if (rest.length === 0) return { why: whyNow(first), then: null };
  const cards = rest.filter((e) => e.type !== "sweep");
  const sweeps = rest.flatMap((e): SweepLink[] => (e.type === "sweep" ? [{ k: e.k, group: e.sweep, count: e.sweep.mails.length, archive: e.sweep.target === "archive" }] : []));
  return {
    why: whyNow(first),
    then: { titles: cards.slice(0, THEN_TITLES).map((e) => ({ k: e.k, title: entryTitle(e) })), more: Math.max(0, cards.length - THEN_TITLES), sweeps },
  };
}

export function meetingCard(queue: readonly Entry[], eventKey: string): Entry | undefined {
  return queue.find((e) => (e.type === "soon" || e.type === "after") && e.item.eventKey === eventKey);
}

export function inboxCard(queue: readonly Entry[]): Entry | undefined {
  return queue.find((e) => e.type === "sweep") ?? queue.find((e) => e.type === "mail");
}

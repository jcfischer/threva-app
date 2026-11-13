import type { Entry } from "./order";

export const THEN_TITLES = 3;

export type WhyNow =
  | { kind: "cortex"; text: string }
  | { kind: "after"; title: string }
  | { kind: "thread" }
  | { kind: "task" };

export interface SweepLink {
  k: string;
  label: string;
  count: number;
}

export interface ThenLine {
  titles: string[];
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
    case "soon":
      return entry.item.why ? { kind: "cortex", text: entry.item.why } : null;
    case "sweep":
      return entry.sweep.why ? { kind: "cortex", text: entry.sweep.why } : null;
    case "after":
      return { kind: "after", title: entry.event.title };
    case "thread":
      return { kind: "thread" };
    case "task":
      return { kind: "task" };
  }
}

export function entryTitle(entry: Entry): string {
  switch (entry.type) {
    case "agent":
    case "item":
    case "mail":
    case "soon":
      return entry.item.title;
    case "sweep":
      return entry.sweep.title || entry.sweep.label;
    case "after":
      return entry.event.title;
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
  const sweeps = rest.flatMap((e): SweepLink[] => (e.type === "sweep" ? [{ k: e.k, label: e.sweep.label || e.sweep.title, count: e.sweep.mails.length }] : []));
  return {
    why: whyNow(first),
    then: { titles: cards.slice(0, THEN_TITLES).map(entryTitle), more: Math.max(0, cards.length - THEN_TITLES), sweeps },
  };
}

import type { MemoryClient } from "@desk/memory-client";
import type { DeskItem, DeskView, MailRule, MailSweep, MyDayOutline, StudioList, StudioNote, StudioThread } from "@desk/types";

export const NOW = Date.parse("2026-11-13T10:00:00+01:00");
export const DAY = "2026-11-13";

export function item(overrides: Partial<DeskItem> & Pick<DeskItem, "key" | "kind">): DeskItem {
  return {
    source: "test",
    area: null,
    title: `Item ${overrides.key}`,
    why: "Because.",
    score: 1,
    urgency: "today",
    actions: [],
    detail: { summary: "", links: [] },
    ...overrides,
  };
}

export function afterMeeting(key: string, title: string): DeskItem {
  return item({
    key: `after-${key}`,
    kind: "meeting-after",
    title: `${title} ended.`,
    why: "It ended 5 minutes ago.",
    eventKey: key,
    detail: { summary: title, links: [] },
  });
}

export function view(overrides: Partial<DeskView> = {}): DeskView {
  return { generatedAt: NOW, displayName: null, items: [], today: [], ...overrides };
}

export function seededApp(client: MemoryClient, {
  desk = view(),
  myDay = { date: DAY, revision: 1, outline: { id: "root", title: "Everything", ordering: "parallel", weight: 1, children: [] } },
  rules = [],
}: { desk?: DeskView | (() => DeskView); myDay?: MyDayOutline; rules?: MailRule[] } = {}): void {
  client.seed("desk", () => ({ ok: true, data: typeof desk === "function" ? desk() : desk }));
  client.seed("studio", { ok: true, data: { studio: null } });
  client.seed("rules", { ok: true, data: { rules } });
  client.seed("myDay", { ok: true, data: myDay });
}

export function sweep(overrides: Partial<MailSweep> = {}): MailSweep {
  return { id: "news", kind: "sweep", target: "archive", label: "Newsletters", title: "Weekly news", why: "Unread.", mails: [], ...overrides };
}

export function thread(slug: string, waitsOnYou: boolean, answered = false): StudioThread {
  const note: StudioNote = { at: "2026-11-13T08:00:00+01:00", kind: "note", status: "open", text: "A note waiting on you." };
  return {
    slug,
    type: "question",
    question: `Question ${slug}?`,
    stand: "Where it stands.",
    notes: [note],
    derived: { waitsOnYou, notes: { open: [note], kept: [] } },
    responses: answered ? [{ at: "2026-11-13T09:00:00+01:00", re: note.at, text: "My answer." }] : [],
  };
}

export function studio(...threads: StudioThread[]): StudioList {
  return { studio: { active: threads } };
}

import type { DeskItem, DeskView, StudioList, StudioThread } from "../../src/ui/api/types";

export const NOW = Date.parse("2026-11-13T10:00:00+01:00");

export function item(overrides: Partial<DeskItem> & Pick<DeskItem, "key" | "kind">): DeskItem {
  return {
    source: "test",
    title: `Item ${overrides.key}`,
    why: "Because.",
    score: 1,
    urgency: "today",
    actions: [],
    detail: { summary: "", links: [] },
    ...overrides,
  };
}

export function view(overrides: Partial<DeskView> = {}): DeskView {
  return { generatedAt: NOW, displayName: null, items: [], today: [], ...overrides };
}

export function thread(slug: string, noteStatus: string, answered: boolean): StudioThread {
  return {
    slug,
    question: `Question ${slug}?`,
    stand: "Where it stands.",
    notes: [{ at: "2026-11-13T08:00:00+01:00", kind: "stand", status: noteStatus as StudioThread["notes"][number]["status"], text: "A proposed stand." }],
    responses: answered ? [{ at: "2026-11-13T09:00:00+01:00", text: "My answer." }] : [],
  };
}

export function studio(...threads: StudioThread[]): StudioList {
  return { studio: { active: threads } };
}

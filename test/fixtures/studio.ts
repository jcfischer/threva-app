import type { StudioList, StudioThread } from "../../src/ui/api/types";

// Recorded from the dev stack's `GET /api/desk/studio` (thread budget-next-year), with a stand proposal, a kept idea
// and a relation note added in the shape of Cortex's docs/desk-studio.md sample.
export const budgetThread: StudioThread = {
  slug: "budget-next-year",
  state: "active",
  thinkTonight: false,
  question: "What goes into next year's budget?",
  stand: "Keep the team as it is and cut travel.",
  notes: [
    {
      at: "2026-11-13T20:48:41Z",
      trigger: "Sample thread",
      kind: "note",
      status: "open",
      text: "Ada's draft adds two hires. Does cutting travel still cover them, or does one hire wait until summer?",
    },
    {
      at: "2026-11-12T03:12:00Z",
      trigger: "Stale thread: unchanged for 6 days",
      kind: "idea",
      status: "kept",
      text: "Ask Ada which hire matters most.",
    },
    {
      at: "2026-11-13T03:14:00Z",
      trigger: "Stale thread: unchanged for 6 days",
      kind: "stand",
      status: "open",
      because: "Travel was a third of last year's spend.",
      text: "Hire one now, the second in summer.",
    },
    {
      at: "2026-11-13T03:15:00Z",
      trigger: "Shared material",
      kind: "relation",
      status: "open",
      text: "This relates to the March offsite.",
    },
  ],
  responses: [{ at: "2026-11-12T09:40:00Z", re: "2026-11-12T03:12:00Z", text: "Ada says the designer first." }],
  material: [
    { kind: "person", label: "Ada Lovelace" },
    { kind: "file", label: "BRIEF.md", href: "https://example.org/brief" },
  ],
};

// Recorded from the dev stack's `GET /api/desk/studio` after a close act closed the budget thread as dropped, with the
// fields Threva reads kept as Cortex sent them. The `closed` day is a `YYYY-MM-DD` date, not a timestamp.
export const closedThread: StudioThread = {
  slug: "budget-next-year",
  state: "closed",
  closed: "2026-11-14",
  outcome: "dropped",
  question: "What goes into next year's budget?",
  stand: "Keep the team as it is and cut travel.",
  notes: [
    {
      at: "2026-11-13T20:49:01Z",
      trigger: "Sample thread",
      kind: "note",
      status: "open",
      text: "Ada's draft adds two hires. Does cutting travel still cover them, or does one hire wait until summer?",
    },
  ],
  responses: [],
  material: [
    { kind: "person", label: "Ada Lovelace" },
    { kind: "mail", label: "Budget for next year" },
  ],
};

export const studioList = (active: StudioThread[], parked: StudioThread[] = [], closed: StudioThread[] = []): StudioList => ({ studio: { active, parked, closed } });

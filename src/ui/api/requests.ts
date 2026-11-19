import type { Recurrence, ThreadOutcome } from "@the-metafactory/cortex/desk-api";

export interface OutlineDetails {
  title: string;
  weight: number;
  note: string;
  ordering: "parallel" | "sequential";
  focus: boolean;
  dueDate: string;
  context: string;
  effort: 1 | 2 | 4;
  estimateMinutes: number | null;
  startDate?: string;
  deferredUntil?: string;
  repeat?: (Recurrence & { mode: "calendar" | "completion" }) | null;
}

export type OutlineCommand =
  | { op: "outline-add"; revision: number; parent: string; title: string; kind?: "task" }
  | { op: "outline-move"; revision: number; id: string; parent: string; index: number }
  | { op: "outline-edit"; revision: number; id: string; details: OutlineDetails; yes: boolean }
  | { op: "outline-complete" | "outline-reopen" | "outline-remove"; revision: number; id: string; confirm: true };

export type MyDayCommand =
  | OutlineCommand
  | { op: "todo"; key: string; fingerprint: string }
  | { op: "done"; id: string };

export type SparMode = "think" | "grill" | "other-side" | "red-team" | "first-principles" | `persona:${string}`;

export type StudioAct =
  | { act: "respond"; thread: string; text: string }
  | { act: "keep" | "dismiss"; thread: string; note: string }
  | { act: "park"; thread: string }
  | { act: "unpark"; thread: string }
  | { act: "think"; thread: string; on: boolean }
  | { act: "spar"; thread: string; mode: SparMode }
  | { act: "close"; thread: string; outcome: ThreadOutcome; text: string; expect?: string; reviewOn?: string };

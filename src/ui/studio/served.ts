import type { StudioDerived, StudioNote, StudioThread } from "@desk/types";

export type ServedNotes = StudioDerived["notes"];

type Served = Pick<StudioThread, "derived">;

const NO_NOTES: ServedNotes = { open: [], kept: [] };

export function servedNotes(thread: Served): ServedNotes {
  return thread.derived?.notes ?? NO_NOTES;
}

export function visibleNotes(thread: Served): StudioNote[] {
  const { open, kept } = servedNotes(thread);
  return [...open, ...kept];
}

export function waitsOnYou(thread: Served): boolean {
  return thread.derived?.waitsOnYou === true;
}

export function newestNote(notes: readonly StudioNote[]): StudioNote | null {
  return notes.reduce<StudioNote | null>((newest, note) => (!newest || Date.parse(note.at) >= Date.parse(newest.at) ? note : newest), null);
}

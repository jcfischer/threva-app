import type { StudioNote, StudioThread } from "@desk/types";
import { newestNote, servedNotes } from "./served";

/** The lines a waiting note takes on the Day card before "Show all" offers the rest. */
export const NOTE_LINES = 6;


const CHARS_PER_LINE = 72;

/** What the card offers for its note: an answer in one line, or a ruling on a proposal. */
export type NoteAct = "answer" | "keep" | "dismiss";

export interface DayCardNote {
  at: string;
  kind: StudioNote["kind"];
  text: string;
}

/** What a Studio topic's card in the Day view shows: the question, the note that waits, and the reason it is here. */
export interface DayCard {
  question: string;
  stand: string | null;
  note: DayCardNote | null;
  acts: NoteAct[];
  reason: "delivered" | null;
  long: boolean;
}

export function newestOpenNote(thread: StudioThread): StudioNote | null {
  return newestNote(servedNotes(thread).open);
}

export function noteIsLong(text: string, lines: number = NOTE_LINES): boolean {
  const wrapped = text.split("\n").reduce((count, line) => count + Math.max(1, Math.ceil(line.trim().length / CHARS_PER_LINE)), 0);
  return wrapped > lines;
}

export function dayCard(thread: StudioThread): DayCard {
  const note = newestOpenNote(thread);
  const acts: NoteAct[] = note === null ? [] : note.kind === "note" ? ["answer"] : ["keep", "dismiss"];
  return {
    question: thread.question,
    stand: thread.type === "question" && thread.stand.trim() ? thread.stand : null,
    note: note && { at: note.at, kind: note.kind, text: note.text },
    acts,
    reason: note === null ? null : "delivered",
    long: note !== null && noteIsLong(note.text),
  };
}

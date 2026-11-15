import type { StudioNote, StudioThread } from "../api/types";

/** The lines a waiting note takes on the Day card before "Show all" offers the rest. */
export const NOTE_LINES = 6;

// A note is prose in the card's own column. 72 characters per line understates that width on purpose: a note that
// would be cut always offers "Show all", while one that fits may offer it too.
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
  /** The stand is one quiet line, and only on a `question` topic (D11). */
  stand: string | null;
  /** The newest open note: the one the answer or the ruling is for. Which note asks is a Cortex gap (cortex#3652). */
  note: DayCardNote | null;
  /** A plain note is answered; a stand, an idea or a relation is kept or dismissed. */
  acts: NoteAct[];
  /** Why the topic is on the Day view (D12). Until Cortex names the other reasons, a delivered note is the only one. */
  reason: "delivered" | null;
  /** Whether the note runs past the six lines the card shows. */
  long: boolean;
}

export function newestOpenNote(thread: StudioThread): StudioNote | null {
  return thread.notes
    .filter((note) => note.status === "open")
    .reduce<StudioNote | null>((newest, note) => (!newest || Date.parse(note.at) >= Date.parse(newest.at) ? note : newest), null);
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

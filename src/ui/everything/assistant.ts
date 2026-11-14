import { newRequestId, type DeskClient } from "../api/client";
import type { PlaceStore } from "./note";

export type AskKind = "answer" | "shorten";

export interface OpenNote {
  id: string;
  kind: AskKind;
  question: string;
  passage: string | null;
  reply: string;
  replacement?: string;
  at: string;
}

export interface Span {
  from: number;
  to: number;
}

/** Where the quoted text stands in the page: the first exact match, else the first match ignoring edge whitespace. */
export function findPassage(page: string, passage: string | null): Span | null {
  if (!passage) return null;
  const exact = page.indexOf(passage);
  if (exact !== -1) return { from: exact, to: exact + passage.length };
  const trimmed = passage.trim();
  if (!trimmed) return null;
  const at = page.indexOf(trimmed);
  return at === -1 ? null : { from: at, to: at + trimmed.length };
}

/** The nearest line above `before` that has text, or null when there is none. */
export function lineAbove(page: string, before: number): string | null {
  const lines = page.slice(0, Math.max(0, before)).split("\n");
  lines.pop();
  for (let at = lines.length - 1; at >= 0; at--) {
    const text = lines[at]!.trim();
    if (text) return text;
  }
  return null;
}

const lineEnd = (page: string, at: number) => {
  const end = page.indexOf("\n", at);
  return end === -1 ? page.length : end;
};

/** The quote Keep writes: the assistant's name and the date in bold, then the answer, every line quoted. */
export function keptQuote(name: string, date: string, reply: string): string {
  const body = reply.trim().split(/\r?\n/).map(line => (line ? `> ${line}` : ">"));
  return [`> **${name}, ${date}**`, ...body].join("\n");
}

/** The page after Keep: the quote below the line of its passage, or at the end when the passage is gone. */
export function pageAfterKeep(page: string, note: Pick<OpenNote, "passage" | "reply">, name: string, date: string): string {
  const quote = keptQuote(name, date, note.reply);
  const span = findPassage(page, note.passage);
  const end = span ? lineEnd(page, span.to) : page.length;
  const before = page.slice(0, end);
  const after = page.slice(end);
  if (!before.trim()) return `${quote}${after}`;
  const gap = before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  return `${before}${gap}${quote}${after === "" ? "" : after.startsWith("\n\n") ? "" : "\n"}${after}`;
}

/** The page after Replace, or null when the passage is no longer in it. */
export function pageAfterReplace(page: string, note: Pick<OpenNote, "passage" | "replacement">): string | null {
  const span = findPassage(page, note.passage);
  if (!span || note.replacement === undefined) return null;
  return page.slice(0, span.from) + note.replacement + page.slice(span.to);
}

export interface Slot {
  id: string;
  top: number | null;
  height: number;
}

/** Margin notes in page order, each pushed below the one before it; a note without a place stands last. */
export function layoutNotes(slots: readonly Slot[], gap = 8): { tops: Record<string, number>; bottom: number } {
  const ordered = slots.map((slot, index) => ({ slot, index }))
    .sort((a, b) => (a.slot.top === null ? 1 : 0) - (b.slot.top === null ? 1 : 0) || (a.slot.top ?? 0) - (b.slot.top ?? 0) || a.index - b.index);
  const tops: Record<string, number> = {};
  let floor = 0;
  for (const { slot } of ordered) {
    const top = Math.max(slot.top ?? floor, floor);
    tops[slot.id] = top;
    floor = top + slot.height + gap;
  }
  return { tops, bottom: Math.max(0, floor - gap) };
}

export type AskOutcome = { ok: true; reply: string; replacement?: string } | { ok: false; message: string | null };

export interface AskRequest {
  client: Pick<DeskClient, "post">;
  row: string;
  kind: AskKind;
  question?: string;
  passage?: string | null;
  requestId?: string;
}

/** One ask with a fresh request id; it is never sent again with the same one. */
export async function askAssistant({ client, row, kind, question, passage, requestId = newRequestId() }: AskRequest): Promise<AskOutcome> {
  const body: Record<string, unknown> = { requestId, row, kind };
  if (kind === "answer") body.question = question;
  if (passage) body.passage = passage;
  const result = await client.post<{ ok?: unknown; reply?: unknown; replacement?: unknown }>("/api/desk/outline/ask", body);
  if (!result.ok) return { ok: false, message: result.message };
  const data = result.data;
  if (data.ok !== true || typeof data.reply !== "string") return { ok: false, message: null };
  return typeof data.replacement === "string" ? { ok: true, reply: data.reply, replacement: data.replacement } : { ok: true, reply: data.reply };
}

const notesKey = (row: string) => `threva.everything.assistant.${row}`;

const isNote = (value: unknown): value is OpenNote => {
  if (typeof value !== "object" || value === null) return false;
  const note = value as Record<string, unknown>;
  return typeof note.id === "string" && (note.kind === "answer" || note.kind === "shorten") && typeof note.question === "string"
    && (note.passage === null || typeof note.passage === "string") && typeof note.reply === "string"
    && (note.replacement === undefined || typeof note.replacement === "string") && typeof note.at === "string";
};

/** A row's open notes, held in the browser's storage. */
export class AssistantNotes {
  readonly #storage: PlaceStore;

  constructor(storage: PlaceStore) {
    this.#storage = storage;
  }

  list(row: string): OpenNote[] {
    try {
      const raw = this.#storage.getItem(notesKey(row));
      const parsed: unknown = raw === null ? [] : JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isNote) : [];
    } catch {
      return [];
    }
  }

  /** Calls `listener` with the row whenever any store changes a row's notes; returns the way to stop. */
  static subscribe(listener: (row: string) => void): () => void {
    AssistantNotes.#listeners.add(listener);
    return () => { AssistantNotes.#listeners.delete(listener); };
  }

  static readonly #listeners = new Set<(row: string) => void>();

  /** False when the browser would not store the note. */
  add(row: string, note: OpenNote): boolean {
    return this.#write(row, [...this.list(row).filter(kept => kept.id !== note.id), note]);
  }

  remove(row: string, id: string): boolean {
    return this.#write(row, this.list(row).filter(note => note.id !== id));
  }

  #write(row: string, notes: OpenNote[]): boolean {
    try {
      if (notes.length) this.#storage.setItem(notesKey(row), JSON.stringify(notes));
      else this.#storage.removeItem(notesKey(row));
    } catch {
      return false;
    }
    for (const listener of AssistantNotes.#listeners) listener(row);
    return true;
  }
}

/** The date a kept quote carries: the local day as YYYY-MM-DD. */
export function localDate(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

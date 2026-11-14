// What the bar offers under the input, and which row Enter takes. The shape follows oneSuggest in
// the prototype: the row Enter takes is first, so one arrow press down reaches the first match.
import { entryTitle } from "../queue/around";
import type { Entry } from "../queue/order";
import { looksLikeQuestion } from "./state";

export const MATCH_LIMIT = 6;
export const MIN_WORD = 2;

export type Suggestion =
  | { kind: "note"; text: string }
  | { kind: "ask"; text: string }
  | { kind: "match"; entry: Entry; title: string; front: boolean };

const WORD = /[\p{L}\p{N}]+/gu;

export function typedWords(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? []).filter((word) => word.length >= MIN_WORD);
}

// Every typed word of two or more letters has to occur in the title, ignoring case.
export function matchEntries(text: string, entries: readonly Entry[], limit = MATCH_LIMIT): { entry: Entry; index: number }[] {
  const words = typedWords(text);
  if (!words.length) return [];
  const hits: { entry: Entry; index: number }[] = [];
  for (const [index, entry] of entries.entries()) {
    const title = entryTitle(entry).toLowerCase();
    if (!words.every((word) => title.includes(word))) continue;
    hits.push({ entry, index });
    if (hits.length === limit) break;
  }
  return hits;
}

// A question asks first, one or two words with a match start at that match, anything else notes the text.
export function suggest(text: string, entries: readonly Entry[]): Suggestion[] {
  const typed = text.trim();
  if (!typed) return [];
  const hits: Suggestion[] = matchEntries(typed, entries).map(({ entry, index }) => ({ kind: "match", entry, title: entryTitle(entry), front: index === 0 }));
  const note: Suggestion = { kind: "note", text: typed };
  const ask: Suggestion = { kind: "ask", text: typed };
  if (looksLikeQuestion(typed)) return [ask, ...hits, note];
  if (hits.length && typedWords(typed).length <= 2) return [...hits, note, ask];
  return [note, ...hits, ask];
}

// What Enter does with the row it takes: the note flow, the conversation, or bringing a card to the front.
export type BarAct = { kind: "note" } | { kind: "ask" } | { kind: "match"; k: string };

export function actFor(row: Suggestion | undefined): BarAct {
  if (row?.kind === "ask") return { kind: "ask" };
  if (row?.kind === "match") return { kind: "match", k: row.entry.k };
  return { kind: "note" };
}

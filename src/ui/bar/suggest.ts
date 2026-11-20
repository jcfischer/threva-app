import { entryTitle } from "../queue/around";
import type { Entry } from "../queue/order";
import { looksLikeQuestion } from "./state";

export const MATCH_LIMIT = 6;
export const MIN_WORD = 2;

export type Suggestion =
  | { kind: "note"; text: string }
  | { kind: "ask"; text: string }
  | { kind: "search"; text: string }
  | { kind: "match"; entry: Entry; title: string; front: boolean };

const WORD = /[\p{L}\p{N}]+/gu;

export function typedWords(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? []).filter((word) => word.length >= MIN_WORD);
}

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

export function suggest(text: string, entries: readonly Entry[]): Suggestion[] {
  const typed = text.trim();
  if (!typed) return [];
  const hits: Suggestion[] = matchEntries(typed, entries).map(({ entry, index }) => ({ kind: "match", entry, title: entryTitle(entry), front: index === 0 }));
  const note: Suggestion = { kind: "note", text: typed };
  const ask: Suggestion = { kind: "ask", text: typed };
  const search: Suggestion = { kind: "search", text: typed };
  if (looksLikeQuestion(typed)) return [ask, ...hits, note, search];
  if (hits.length && typedWords(typed).length <= 2) return [...hits, note, ask, search];
  return [note, ...hits, ask, search];
}

export type BarAct = { kind: "note" } | { kind: "ask" } | { kind: "search" } | { kind: "match"; k: string };

export function actFor(row: Suggestion | undefined): BarAct {
  if (row?.kind === "ask" || row?.kind === "search") return { kind: row.kind };
  if (row?.kind === "match") return { kind: "match", k: row.entry.k };
  return { kind: "note" };
}

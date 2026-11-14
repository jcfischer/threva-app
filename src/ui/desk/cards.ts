import type { StudioMaterial, StudioNote, StudioThread } from "../api/types";

export const FAINT_FROM = 5;

export type DeskStrength = "open" | "dim" | "faint";

export type DeskCard =
  | { side: "left"; label: string; kind: string; href?: string }
  | { side: "right"; at: string; strength: DeskStrength; sentence: string };

/** The text up to its first sentence end, or all of it when it has none. */
export function firstSentence(text: string): string {
  const flat = text.trim().replace(/\s+/g, " ");
  const end = flat.search(/[.!?](\s|$)/);
  return end === -1 ? flat : flat.slice(0, end + 1);
}

export function noteCards(notes: readonly StudioNote[]): Extract<DeskCard, { side: "right" }>[] {
  return notes
    .filter((note) => note.status !== "dismissed" && note.kind !== "relation")
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((note, index) => ({
      side: "right" as const,
      at: note.at,
      strength: note.status === "open" ? ("open" as const) : index >= FAINT_FROM ? ("faint" as const) : ("dim" as const),
      sentence: firstSentence(note.text),
    }));
}

export function materialCards(material: readonly StudioMaterial[]): Extract<DeskCard, { side: "left" }>[] {
  return material.map((m) => ({ side: "left" as const, label: m.label, kind: m.kind, href: m.href }));
}

/** The small cards of a desk: material on the left, notes on the right, newest first. */
export function deskCards(thread: StudioThread): DeskCard[] {
  return [...materialCards(thread.material ?? []), ...noteCards(thread.notes)];
}

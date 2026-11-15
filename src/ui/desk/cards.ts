import type { StudioList, StudioMaterial, StudioNote, StudioNoteKind, StudioThread } from "../api/types";
import { safeHref } from "../api/safe-link";

export const FAINT_FROM = 5;

export { ago } from "../i18n/ago";

export type DeskSide = "left" | "right";

export type DeskStrength = "open" | "dim" | "faint";

export type DeskCard =
  | { side: "left"; id: string; index: number; label: string; kind: string; href?: string }
  | { side: "right"; id: string; at: string; kind: StudioNoteKind; strength: DeskStrength; sentence: string };

export type OpenThing =
  | { side: "left"; id: string; material: StudioMaterial }
  | { side: "left"; id: string; topic: StudioThread }
  | { side: "right"; id: string; note: StudioNote };

export type RelationTarget =
  | { kind: "topic"; topic: StudioThread }
  | { kind: "text"; label: string }
  | { kind: "link"; label: string; href: string };

export function findThread(studio: StudioList | null, slug: string): StudioThread | undefined {
  const data = studio?.studio;
  return data ? [...data.active, ...(data.parked ?? []), ...(data.closed ?? [])].find((thread) => thread.slug === slug) : undefined;
}

export function relationTarget(note: StudioNote, studio: StudioList | null): RelationTarget | null {
  if (note.kind !== "relation" || !note.relates) return null;
  const { kind, label, href } = note.relates;
  if (kind === "thread") {
    const topic = findThread(studio, label);
    if (topic) return { kind: "topic", topic };
  }
  const safe = kind === "link" ? safeHref(href) : undefined;
  return safe ? { kind: "link", label, href: safe } : { kind: "text", label };
}

/** The text up to its first sentence end, or all of it when it has none. */
export function firstSentence(text: string): string {
  const flat = text.trim().replace(/\s+/g, " ");
  const end = flat.search(/[.!?](\s|$)/);
  return end === -1 ? flat : flat.slice(0, end + 1);
}

export function noteCards(notes: readonly StudioNote[]): Extract<DeskCard, { side: "right" }>[] {
  return notes
    .filter((note) => note.status !== "dismissed")
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((note, index) => ({
      side: "right" as const,
      id: note.at,
      at: note.at,
      kind: note.kind,
      strength: note.status === "open" ? ("open" as const) : index >= FAINT_FROM ? ("faint" as const) : ("dim" as const),
      sentence: firstSentence(note.text),
    }));
}

export function materialCards(material: readonly StudioMaterial[]): Extract<DeskCard, { side: "left" }>[] {
  return material.map((m, index) => ({ side: "left" as const, id: `m${index}`, index, label: m.label, kind: m.kind, href: m.href }));
}

/** The small cards of a desk: material on the left, notes on the right, newest first. */
export function deskCards(thread: StudioThread): DeskCard[] {
  return [...materialCards(thread.material ?? []), ...noteCards(thread.notes)];
}

/** The thing a parked card stands for, or null when it has left the desk since the click. */
export function openThing(thread: StudioThread, id: string | null): OpenThing | null {
  if (id === null) return null;
  if (id.startsWith("m")) {
    const material = thread.material?.[Number(id.slice(1))];
    return material ? { side: "left", id, material } : null;
  }
  const note = thread.notes.find((candidate) => candidate.at === id);
  return note ? { side: "right", id, note } : null;
}

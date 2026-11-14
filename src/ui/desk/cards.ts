import type { I18n } from "../i18n";
import type { StudioMaterial, StudioNote, StudioThread } from "../api/types";

export const FAINT_FROM = 5;

const MINUTE = 60_000;

export function ago(i18n: Pick<I18n, "t">, at: string, now: number): string {
  const ms = now - Date.parse(at);
  if (Number.isNaN(ms)) return at;
  const minutes = Math.max(0, Math.floor(ms / MINUTE));
  if (minutes < 1) return i18n.t("desk.ago.now");
  if (minutes < 60) return i18n.t("desk.ago.m", { n: minutes });
  if (minutes < 60 * 24) return i18n.t("desk.ago.h", { n: Math.floor(minutes / 60) });
  return i18n.t("desk.ago.d", { n: Math.floor(minutes / 60 / 24) });
}

export type DeskSide = "left" | "right";

export type DeskStrength = "open" | "dim" | "faint";

// A parked card keeps the id of the thing it stands for, so an opened card can find it and its place.
export type DeskCard =
  | { side: "left"; id: string; index: number; label: string; kind: string; href?: string }
  | { side: "right"; id: string; at: string; strength: DeskStrength; sentence: string };

/** What an opened card shows: one material item on the left, or one note on the right. */
export type OpenThing =
  | { side: "left"; id: string; material: StudioMaterial }
  | { side: "right"; id: string; note: StudioNote };

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
      id: note.at,
      at: note.at,
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

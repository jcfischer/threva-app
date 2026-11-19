import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { StudioMaterial, StudioNote, StudioThread } from "@desk/types";
import { TopicCard } from "../src/ui/desk/topic-card";
import { noteCards, relationTarget } from "../src/ui/desk/cards";
import { OpenCard } from "../src/ui/desk/open-card";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { budgetThread, served, studioList } from "./fixtures/studio";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const relation: StudioNote = budgetThread.notes[3];
const offsiteNote: StudioNote = { at: "2026-11-14T10:00:00Z", kind: "note", status: "kept", text: "Grace asks which week works. The first clashes with the budget review." };
const topic: StudioThread = {
  ...budgetThread,
  slug: "offsite-in-march",
  type: "topic",
  question: "What is the March offsite for?",
  notes: [
    { at: "2026-11-14T11:00:00Z", kind: "idea", status: "dismissed", text: "Do not show this." },
    offsiteNote,
    { at: "2026-11-13T10:00:00Z", kind: "note", status: "open", text: "An older note." },
  ],
  derived: served([], [offsiteNote]),
};
const relating = (relates?: StudioMaterial): StudioNote => ({ ...relation, relates });
const list = studioList([budgetThread, topic]);

describe("relation follow targets", () => {
  test("thread slugs resolve across active, parked and closed topics", () => {
    for (const state of ["active", "parked", "closed"] as const) {
      const target = { ...topic, state };
      const studio = studioList(state === "active" ? [target] : [], state === "parked" ? [target] : [], state === "closed" ? [target] : []);
      expect(relationTarget(relation, studio)).toEqual({ kind: "topic", topic: target });
    }
  });

  test("a missing topic stays plain text, even with an href", () => {
    const note = relating({ kind: "thread", label: "missing-slug", href: "https://example.org" });
    for (const studio of [list, studioList([]), { studio: null }, null]) {
      expect(relationTarget(note, studio)).toEqual({ kind: "text", label: "missing-slug" });
    }
  });

  test("only link relations with safe hrefs become links", () => {
    for (const kind of ["goal", "person", "file"]) {
      expect(relationTarget(relating({ kind, label: "Cortex's label", href: "https://example.org" }), list)).toEqual({ kind: "text", label: "Cortex's label" });
    }
    for (const href of [undefined, "javascript:alert(1)", "data:text/html,hello", "/relative"]) {
      expect(relationTarget(relating({ kind: "link", label: "Read this", href }), list)).toEqual({ kind: "text", label: "Read this" });
    }
    expect(relationTarget(relating({ kind: "link", label: "Read this", href: "https://example.org/notes" }), list)).toEqual({ kind: "link", label: "Read this", href: "https://example.org/notes" });
  });

  test("missing relates and other note kinds have no target", () => {
    expect(relationTarget(relating(), list)).toBeNull();
    expect(relationTarget({ ...relation, kind: "idea" }, list)).toBeNull();
  });

  test("the served notes sort and dim alike, open at full strength", () => {
    const kept: StudioNote[] = Array.from({ length: 7 }, (_, i) => ({ ...relation, at: `2026-11-1${i}T00:00:00Z`, status: "kept" as const }));
    const cards = noteCards({ ...budgetThread, derived: served([{ ...relation, at: "2026-11-18T00:00:00Z", status: "open" }], kept) });
    expect(cards.map(({ at, strength }) => [at, strength])).toEqual([
      ["2026-11-18T00:00:00Z", "open"],
      ["2026-11-16T00:00:00Z", "dim"], ["2026-11-15T00:00:00Z", "dim"], ["2026-11-14T00:00:00Z", "dim"],
      ["2026-11-13T00:00:00Z", "dim"], ["2026-11-12T00:00:00Z", "faint"], ["2026-11-11T00:00:00Z", "faint"], ["2026-11-10T00:00:00Z", "faint"],
    ]);
  });
});

const run = async () => ({ ok: true as const, data: {} });
const renderNote = (note: StudioNote, locale: "en" | "de" = "en") => renderToStaticMarkup(
  <I18nProvider value={createI18n(locale)}>
    <OpenCard thing={{ side: "right", id: note.at, note }} slug={budgetThread.slug} now={NOW} onClose={() => {}} run={run} target={relationTarget(note, list)} onFollow={() => {}} />
  </I18nProvider>,
);

describe("opened relation content", () => {
  test("shows the topic question and Follow, with catalog labels in both languages", () => {
    expect(renderNote(relation)).toContain(topic.question);
    expect(renderNote(relation)).toContain(">Follow<");
    expect(renderNote(relation)).toContain(">Keep<");
    expect(renderNote(relation)).toContain(">Dismiss<");
    const de = renderNote(relation, "de");
    for (const text of ["Bezug", "Folgen", "Behalten", "Verwerfen"]) expect(de).toContain(text);
    for (const status of ["kept", "dismissed"] as const) {
      const html = renderNote({ ...relation, status });
      expect(html).not.toContain(">Keep<");
      expect(html).not.toContain(">Dismiss<");
    }
  });

  test("non-topic labels stay as Cortex sends them and safe links open in a new tab", () => {
    for (const relates of [
      { kind: "thread", label: "gone-topic" }, { kind: "goal", label: "G5: one post a week" }, { kind: "person", label: "Ana" },
      { kind: "link", label: "Unsafe", href: "javascript:alert(1)" }, { kind: "link", label: "No href" },
    ]) {
      const html = renderNote(relating(relates));
      expect(html).toContain(relates.label);
      expect(html).not.toContain(">Follow<");
      expect(html).not.toContain("<a ");
    }
    expect(renderNote(relating({ kind: "link", label: "Read this", href: "https://example.org/notes" }))).toContain('href="https://example.org/notes" target="_blank" rel="noreferrer">Read this</a>');
  });

  test("the topic summary shows its exact type, state and newest nondismissed first sentence", () => {
    for (const locale of ["en", "de"] as const) {
      for (const type of ["question", "topic", "making"] as const) {
        for (const state of ["active", "parked", "closed"] as const) {
          const i18n = createI18n(locale);
          const html = renderToStaticMarkup(<I18nProvider value={i18n}>
            <TopicCard topic={{ ...topic, type, state }} now={NOW} onClose={() => {}} onOpenDesk={() => {}} />
          </I18nProvider>);
          expect(html).toContain(i18n.t(`desk.topic.type.${type}`));
          expect(html).toContain(topic.question);
          expect(html).toContain("Grace asks which week works.");
          expect(html).toContain(locale === "en" ? "2 h ago" : "vor 2 Std.");
          expect(html).not.toContain("The first clashes");
          expect(html).not.toContain("Do not show this");
          expect(html).toContain(i18n.t("desk.topic.open"));
          if (state !== "active") expect(html).toContain(i18n.t(`desk.topic.${state}`));
        }
      }
    }
  });
});


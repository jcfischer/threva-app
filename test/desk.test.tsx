import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@desk/client";
import { QueueContext } from "../src/ui/cards/act";
import { deskCards, firstSentence, noteCards } from "../src/ui/desk/cards";
import { Desk } from "../src/ui/desk/desk";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { StudioCard } from "../src/ui/studio/card";
import type { StudioNote, StudioThread } from "@desk/types";
import { budgetThread, served, studioList } from "./fixtures/studio";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const client = createClient(async () => new Response("{}"));
const render = (studio = studioList([budgetThread]), slug = budgetThread.slug, locale: "en" | "de" = "en") =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <Desk client={client} studio={studio} slug={slug} backLabel="Back" onBack={() => {}} now={NOW} />
    </I18nProvider>,
  );

describe("desk cards", () => {
  test("the first sentence ends at the first full stop followed by a space or the end", () => {
    expect(firstSentence("Does cutting travel still cover them, or does one hire wait until summer? Then say so.")).toBe("Does cutting travel still cover them, or does one hire wait until summer?");
    expect(firstSentence("No end")).toBe("No end");
    expect(firstSentence("Version 1.2 is out. More")).toBe("Version 1.2 is out.");
  });

  test("the notes Cortex serves are newest first, the open ones at full strength", () => {
    const cards = noteCards(budgetThread);
    expect(cards.map((c) => [c.at, c.strength])).toEqual([
      ["2026-11-13T20:48:41Z", "open"],
      ["2026-11-12T03:12:00Z", "dim"],
    ]);
    expect(noteCards({ ...budgetThread, derived: undefined })).toEqual([]);
  });

  test("from the sixth card on, notes that are not open are faint", () => {
    const kept: StudioNote[] = Array.from({ length: 8 }, (_, i) => ({ at: `2026-11-1${i}T00:00:00Z`, kind: "note", status: "kept", text: `N${i}.` }));
    expect(noteCards({ ...budgetThread, derived: served([], kept) }).map((c) => c.strength)).toEqual(["dim", "dim", "dim", "dim", "dim", "faint", "faint", "faint"]);
  });

  test("material goes left, notes right", () => {
    const cards = deskCards(budgetThread);
    expect(cards.filter((c) => c.side === "left").map((c) => c.side === "left" && c.label)).toEqual(["Ada Lovelace", "BRIEF.md"]);
    expect(cards.filter((c) => c.side === "right")).toHaveLength(2);
  });
});

describe("the desk", () => {
  test("shows the question, the stand, the responses, the served notes and the material", () => {
    const html = render();
    expect(html).toContain("What goes into next year&#x27;s budget?");
    expect(html).toContain("Keep the team as it is and cut travel.");
    expect(html).toContain("Ada says the designer first.");
    expect(html).toContain("Ada&#x27;s draft adds two hires.");
    expect(html).toContain("Ask Ada which hire matters most.");
    expect(html).toContain("2 d ago");
    expect(html).toContain("desk-card desk-open");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain('data-desk-card="m1"');
    expect(html).not.toContain("March offsite");
    expect(html).not.toContain("Relation");
  });

  test("says so when there is no material", () => {
    const thread: StudioThread = { ...budgetThread, material: [] };
    expect(render(studioList([thread]))).toContain("No material yet.");
  });

  test("a Cortex without the served notes shows an empty notes rail", () => {
    const html = render(studioList([{ ...budgetThread, derived: undefined }]));
    expect(html).toContain("No notes.");
    expect(html).not.toContain('data-desk-card="2026-11-13T20:48:41Z"');
  });

  test("an unreadable Studio or a missing topic shows only the message", () => {
    for (const html of [render({ studio: null }), render(studioList([]), "gone"), render(null as never)]) {
      expect(html).toContain("cannot be shown");
      expect(html).not.toContain("desk-grid");
    }
  });

  test("labels come from the German catalog", () => {
    expect(render(undefined, undefined, "de")).toContain("Die Notizen des Assistenten");
  });
});

describe("the action", () => {
  test("a Studio card opens the desk", () => {
    const html = renderToStaticMarkup(
      <I18nProvider value={createI18n("en")}>
        <QueueContext.Provider value={{ client: createClient(async () => new Response("{}")), refresh: () => {} }}>
          <StudioCard thread={budgetThread} now={NOW} onDesk={() => {}} />
        </QueueContext.Provider>
      </I18nProvider>,
    );
    expect(html).toContain("Open the desk");
  });
});

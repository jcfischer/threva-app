import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BarView } from "../src/ui/bar/bar";
import { barReducer, INITIAL, type BarState } from "../src/ui/bar/state";
import { actFor, matchEntries, suggest, typedWords } from "../src/ui/bar/suggest";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { buildQueue, EMPTY_SESSION } from "../src/ui/queue/order";
import { item, NOW, view } from "./fixtures/desk";

const desk = view({
  items: [
    item({ key: "workshop-dates", kind: "mail", title: "Workshop dates" }),
    item({ key: "report", kind: "mail", title: "Quarterly report" }),
    item({ key: "workshop-follow", kind: "mail", title: "Workshop follow-up" }),
  ],
});
const queue = buildQueue(desk, null, EMPTY_SESSION, NOW);

const busyDesk = view({
  items: Array.from({ length: 8 }, (_, i) => item({ key: `w${i}`, kind: "mail", title: `Workshop ${i}` })),
});
const busyQueue = buildQueue(busyDesk, null, EMPTY_SESSION, NOW);

const kinds = (text: string, entries = queue) => suggest(text, entries).map((row) => row.kind);

describe("the bar's matcher", () => {
  test("keeps the typed words of two or more letters, lowercased", () => {
    expect(typedWords("Workshop a dates")).toEqual(["workshop", "dates"]);
    expect(typedWords("?!")).toEqual([]);
  });

  test("every typed word has to occur in the entry's title, ignoring case", () => {
    expect(matchEntries("WORKSHOP", queue).map(({ entry }) => entry.k)).toEqual(["i:workshop-dates", "i:workshop-follow"]);
    expect(matchEntries("workshop dates", queue).map(({ entry }) => entry.k)).toEqual(["i:workshop-dates"]);
    expect(matchEntries("workshop zzz", queue)).toEqual([]);
    expect(matchEntries("workshopping", queue)).toEqual([]);
  });

  test("stops at six match rows and marks the queue's first entry as the front card", () => {
    const rows = suggest("workshop", busyQueue);
    expect(rows.filter((row) => row.kind === "match")).toHaveLength(6);
    expect(rows[0]).toMatchObject({ kind: "match", front: true });
    expect(rows[1]).toMatchObject({ kind: "match", front: false });
  });
});

describe("what Enter does", () => {
  test("a question asks first, then the matches, then the note", () => {
    const rows = suggest("workshop?", queue);
    expect(rows.map((row) => row.kind)).toEqual(["ask", "match", "match", "note"]);
  });

  test("one or two words with a match start at that match", () => {
    expect(kinds("workshop")).toEqual(["match", "match", "note", "ask"]);
    expect(kinds("workshop dates")).toEqual(["match", "note", "ask"]);
  });

  test("everything else notes the text first, the matches after it", () => {
    expect(kinds("workshop follow up")).toEqual(["note", "match", "ask"]);
    expect(kinds("book a table")).toEqual(["note", "ask"]);
  });

  test("an empty bar offers nothing", () => {
    expect(suggest("", queue)).toEqual([]);
    expect(suggest("   ", queue)).toEqual([]);
  });

  test("the marked row decides what Enter does", () => {
    expect(actFor(suggest("workshop", queue)[0])).toEqual({ kind: "match", k: "i:workshop-dates" });
    expect(actFor(suggest("workshop?", queue)[0])).toEqual({ kind: "ask" });
    expect(actFor(suggest("book a table", queue)[0])).toEqual({ kind: "note" });
    expect(actFor(undefined)).toEqual({ kind: "note" });
  });

  test("the note and ask rows carry the typed text", () => {
    const rows = suggest("  book a table  ", queue);
    expect(rows[0]).toEqual({ kind: "note", text: "book a table" });
    expect(rows[1]).toEqual({ kind: "ask", text: "book a table" });
  });
});

describe("moving the mark", () => {
  test("arrow keys wrap around the rows and typing resets the mark", () => {
    const typed = barReducer(INITIAL, { type: "typed", text: "workshop" });
    const down = barReducer(typed, { type: "move", delta: 1, count: 4 });
    expect(down).toEqual({ phase: "idle", text: "workshop", active: 1 });
    expect(barReducer(down, { type: "move", delta: 3, count: 4 })).toEqual({ phase: "idle", text: "workshop", active: 0 });
    expect(barReducer(typed, { type: "move", delta: -1, count: 4 })).toEqual({ phase: "idle", text: "workshop", active: 3 });
    expect(barReducer(down, { type: "move", delta: 1, count: 0 })).toEqual(down);
    expect(barReducer(down, { type: "typed", text: "worksho" })).toEqual({ phase: "idle", text: "worksho", active: 0 });
  });

  test("Esc clears the bar", () => {
    expect(barReducer({ phase: "idle", text: "workshop", active: 2 }, { type: "clear" })).toEqual(INITIAL);
  });
});

describe("the list under the bar", () => {
  const render = (state: BarState, entries = queue, locale: "en" | "de" = "en") =>
    renderToStaticMarkup(
      <I18nProvider value={createI18n(locale)}>
        <BarView state={state} send={() => {}} onSubmit={() => {}} onKeep={() => {}} onAsk={() => {}} onUndo={() => {}} entries={entries} />
      </I18nProvider>,
    );

  test("shows the note row, the ask row and a row per match with where it sits", () => {
    const html = render({ phase: "idle", text: "workshop", active: 0 });
    expect(html).toContain("Note: “workshop”");
    expect(html).toContain("Ask the assistant: “workshop”");
    expect(html).toContain("Workshop dates");
    expect(html).toContain("Workshop follow-up");
    expect(html).toContain("Front card");
    expect(html).toContain("Later in the queue");
    expect(html).toContain('aria-label="What Enter will do"');
  });

  test("marks the row Enter takes", () => {
    const first = render({ phase: "idle", text: "workshop", active: 0 });
    expect(first.split("<button")[1]).toContain("sg-on");
    expect(first.split("<button")[2]).not.toContain("sg-on");
    const second = render({ phase: "idle", text: "workshop", active: 1 });
    expect(second.split("<button")[1]).not.toContain("sg-on");
    expect(second.split("<button")[2]).toContain("sg-on");
    expect(second.split("<button")[2]).toContain('aria-selected="true"');
  });

  test("a question marks the ask row first", () => {
    const html = render({ phase: "idle", text: "is the workshop done?", active: 0 });
    expect(html.split("<button")[1]).toContain("sg-on");
    expect(html.split("<button")[1]).toContain("Ask the assistant: “is the workshop done?”");
  });

  test("an empty bar and a proposal on screen have no list", () => {
    expect(render(INITIAL)).not.toContain('class="sugg"');
    expect(render({ phase: "proposed", text: "workshop", proposal: { kind: "task", label: "Task", fields: { title: "workshop" } } })).not.toContain('class="sugg"');
    expect(render({ phase: "created", message: "", undo: null })).not.toContain('class="sugg"');
  });

  test("the row labels come from the catalog", () => {
    const html = render({ phase: "idle", text: "workshop", active: 0 }, queue, "de");
    expect(html).toContain("Notieren: «workshop»");
    expect(html).toContain("Den Assistenten fragen: «workshop»");
    expect(html).toContain("Vorderste Karte");
    expect(html).toContain("Später in der Schlange");
  });
});

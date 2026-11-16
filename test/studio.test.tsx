import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryClient, type MemoryClient } from "../src/ui/api/memory-client";
import type { StudioNote, StudioThread } from "../src/ui/api/types";
import { QueueContext } from "../src/ui/cards/act";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { buildQueue, EMPTY_SESSION, openStudio, skip } from "../src/ui/queue/order";
import { StudioCard, StudioOpen, timeline } from "../src/ui/studio/card";
import { dayCard, newestOpenNote, noteIsLong } from "../src/ui/studio/day-card";
import { item, NOW as DESK_NOW, view } from "./fixtures/desk";
import { mountDom, inputText, type MountedDom } from "./fixtures/dom";
import { budgetThread, studioList } from "./fixtures/studio";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const noop = () => {};

function wrap(node: ReactNode, locale: "en" | "de" = "en", refresh: () => void = noop) {
  return <I18nProvider value={createI18n(locale)}>
    <QueueContext.Provider value={{ client: createMemoryClient(), refresh }}>{node}</QueueContext.Provider>
  </I18nProvider>;
}

const card = (thread: StudioThread = budgetThread, locale: "en" | "de" = "en", now = NOW) =>
  renderToStaticMarkup(wrap(<StudioCard thread={thread} now={now} onDesk={noop} />, locale));
const open = (thread: StudioThread = budgetThread, locale: "en" | "de" = "en", personas: readonly string[] = []) =>
  renderToStaticMarkup(wrap(<StudioOpen thread={thread} waits onHide={noop} personas={personas} />, locale));

const note = (overrides: Partial<StudioNote> = {}): StudioNote => ({ at: "2026-11-13T20:48:41Z", kind: "note", status: "open", text: "One hire waits until summer.", ...overrides });
const withNotes = (notes: StudioNote[], type: StudioThread["type"] = "question"): StudioThread => ({ ...budgetThread, type, notes });

describe("dayCard", () => {
  test("shows the newest open note, its age and the answer act", () => {
    const shown = dayCard(budgetThread);
    expect(shown.note).toEqual({ at: "2026-11-13T20:48:41Z", kind: "note", text: "Ada's draft adds two hires. Does cutting travel still cover them, or does one hire wait until summer?" });
    expect(shown.acts).toEqual(["answer"]);
    expect(shown.reason).toBe("delivered");
  });

  test("a stand, an idea or a relation is kept or dismissed instead of answered", () => {
    for (const kind of ["stand", "idea", "relation"] as const) expect(dayCard(withNotes([note({ kind })])).acts).toEqual(["keep", "dismiss"]);
  });

  test("only the newest open note counts, and kept ones stay out", () => {
    const notes = [note({ at: "2026-11-10T08:00:00Z", text: "Old and dismissed.", status: "dismissed" }), note({ at: "2026-11-12T08:00:00Z", text: "Older open." }), note({ at: "2026-11-13T08:00:00Z", text: "Newest open." })];
    expect(dayCard(withNotes(notes)).note?.text).toBe("Newest open.");
    expect(newestOpenNote(withNotes([note({ status: "kept" })]))).toBeNull();
  });

  test("a topic with nothing open shows no note, no act and no reason", () => {
    expect(dayCard(withNotes([note({ status: "kept" })]))).toMatchObject({ note: null, acts: [], reason: null, long: false });
  });

  test("the stand is one line on a question topic and nowhere else", () => {
    expect(dayCard(withNotes([note()], "question")).stand).toBe("Keep the team as it is and cut travel.");
    expect(dayCard(withNotes([note()], "topic")).stand).toBeNull();
    expect(dayCard(withNotes([note()], "making")).stand).toBeNull();
    expect(dayCard({ ...withNotes([note()]), stand: "   " }).stand).toBeNull();
  });

  test("a note that runs past six lines is long, one that fits is not", () => {
    expect(dayCard(withNotes([note()])).long).toBe(false);
    expect(noteIsLong("Six words only.")).toBe(false);
    expect(noteIsLong("word ".repeat(100))).toBe(true);
    expect(noteIsLong(Array.from({ length: 7 }, (_, i) => `Line ${i}`).join("\n"))).toBe(true);
  });
});

describe("the Studio card", () => {
  test("shows the question as a small line, the waiting note and how long ago it was written", () => {
    const html = card();
    expect(html).toContain('class="sub"');
    expect(html).toContain("What goes into next year&#x27;s budget?");
    expect(html).toContain("Ada&#x27;s draft adds two hires.");
    expect(html).toContain("15 h ago");
    expect(html).toContain("Note from the assistant");
    expect(html).not.toContain("Your turn");
    expect(html).not.toContain("stgrid");
  });

  test("a plain note is answered in a line, and a stand or an idea is kept or dismissed", () => {
    const plain = card();
    expect(plain).toContain('aria-label="Your answer"');
    expect(plain).toContain(">Send<");
    const stand = card(withNotes([note({ kind: "stand", text: "Hire one now, the second in summer." })]));
    expect(stand).toContain("Take it as my stand");
    expect(stand).toContain(">Dismiss<");
    expect(stand).not.toContain(">Send<");
    const idea = card(withNotes([note({ kind: "idea", text: "Ask Ada which hire matters most." })]));
    expect(idea).toContain(">Keep<");
    expect(idea).toContain(">Dismiss<");
  });

  test("the note is formatted Markdown", () => {
    const html = card(withNotes([note({ text: "Which **hire** first? See [the brief](https://example.org/brief)." })]));
    expect(html).toContain("<strong>hire</strong>");
    expect(html).toContain('href="https://example.org/brief"');
  });

  test("a note longer than six lines is clamped, with a way to show all of it", () => {
    const long = "Ada's draft adds two hires and a consultant, and it moves the travel budget into the second half of the year. ".repeat(4);
    const html = card(withNotes([note({ text: long })]));
    expect(html).toContain("waittext clamped");
    expect(html).toContain(">Show all<");
    const short = card();
    expect(short).toContain('class="waittext"');
    expect(short).not.toContain(">Show all<");
  });

  test("the stand is one quiet line under the question, and only on a question topic", () => {
    expect(card()).toContain("Keep the team as it is and cut travel.");
    expect(card(withNotes([note()], "topic"))).not.toContain("Keep the team as it is and cut travel.");
    expect(card(withNotes([note()], "making"))).not.toContain("Keep the team as it is and cut travel.");
  });

  test("it offers the desk and nothing else that opens the topic", () => {
    const html = card();
    expect(html).toContain("Open the desk");
    expect(html).not.toContain(">Open<");
  });

  test("labels come from the German catalog", () => {
    const de = card(undefined, "de");
    for (const label of ["Notiz vom Assistenten", "Deine Antwort", ">Senden<", "Den Tisch öffnen", "vor 15 Std."]) expect(de).toContain(label);
    expect(de).not.toContain("Du bist dran");
  });
});

describe("the acts on the card", () => {
  let dom: MountedDom;
  let client: MemoryClient;
  let refreshed: number;
  const writes = () => client.calls.filter((call) => call.name === "studio.act").map((call) => ({ body: call.args[0] as Record<string, unknown>, requestId: call.args[1] }));

  beforeEach(() => {
    dom = mountDom();
    client = createMemoryClient();
    client.seed("studio.act", { ok: true, data: {} });
    refreshed = 0;
  });
  afterEach(async () => {
    await dom.cleanup();
  });

  async function mount(thread: StudioThread, locale: "en" | "de" = "en") {
    await act(async () => {
      dom.root.render(
        <I18nProvider value={createI18n(locale)}>
          <QueueContext.Provider value={{ client, refresh: () => { refreshed += 1; } }}>
            <StudioCard thread={thread} now={NOW} onDesk={noop} />
          </QueueContext.Provider>
        </I18nProvider>,
      );
    });
  }

  const button = (text: string) => Array.from(dom.container.querySelectorAll("button")).find((b) => b.textContent === text)!;
  const click = (text: string) => act(async () => { button(text).click(); });
  const field = () => dom.container.querySelector("input")!;

  test("sending an answer posts respond, empties the field and refreshes the queue", async () => {
    await mount(budgetThread);
    await inputText(field(), " One hire waits until summer. ");
    await click("Send");
    expect(writes()).toHaveLength(1);
    expect(writes()[0]?.body).toMatchObject({ act: "respond", thread: "budget-next-year", text: "One hire waits until summer." });
    expect(refreshed).toBe(1);
    expect(field().value).toBe("");
  });

  test("a refusal shows Cortex's message on the card and keeps the typed answer", async () => {
    client.seed("studio.act", { ok: false, message: "The Studio has uncommitted changes.", status: 409 });
    await mount(budgetThread);
    await inputText(field(), "One hire waits until summer.");
    await click("Send");
    expect(dom.container.textContent).toContain("The Studio has uncommitted changes.");
    expect(field().value).toBe("One hire waits until summer.");
    expect(refreshed).toBe(0);
  });

  test("keeping a stand sends keep with the note's time, and dismiss sends dismiss", async () => {
    const stand = withNotes([note({ kind: "stand", at: "2026-11-13T03:14:00Z", text: "Hire one now, the second in summer." })]);
    await mount(stand);
    await click("Take it as my stand");
    expect(writes()[0]?.body).toMatchObject({ act: "keep", thread: "budget-next-year", note: "2026-11-13T03:14:00Z" });
    expect(refreshed).toBe(1);
    await click("Dismiss");
    expect(writes()[1]?.body).toMatchObject({ act: "dismiss", thread: "budget-next-year", note: "2026-11-13T03:14:00Z" });
  });
});

describe("the card in the queue", () => {
  const answered = { ...budgetThread, responses: [...budgetThread.responses, { at: "2026-11-13T21:00:00Z", text: "One hire waits." }] };

  test("a waiting topic comes before fresh items, and leaves once it is answered", () => {
    const desk = view({ items: [item({ key: "fresh", kind: "sensor", score: 1, since: DESK_NOW })] });
    expect(buildQueue(desk, studioList([budgetThread]), EMPTY_SESSION, DESK_NOW).map((e) => e.k)).toEqual(["t:budget-next-year", "i:fresh"]);
    expect(buildQueue(desk, studioList([answered]), EMPTY_SESSION, DESK_NOW).map((e) => e.k)).toEqual(["i:fresh"]);
  });

  test("the open view is no longer reachable from the queue, and the session still holds a topic first", () => {
    const session = openStudio(EMPTY_SESSION, "budget-next-year");
    expect(buildQueue(view(), studioList([answered]), session, DESK_NOW)[0]).toMatchObject({ k: "t:budget-next-year", type: "thread", waits: false });
    expect(buildQueue(view(), studioList([], [{ ...budgetThread, state: "parked" }]), session, DESK_NOW)[0]?.k).toBe("t:budget-next-year");
    expect(skip(session, "t:budget-next-year").open).toBeNull();
    expect(card()).not.toMatch(/<textarea/);
    expect(card()).not.toContain("Where I stand");
  });
});

describe("the open view", () => {
  test("shows the stand, the notes and responses in time order, and the material in the rail", () => {
    const html = open();
    expect(html).toContain("Keep the team as it is and cut travel.");
    const order = ["Ask Ada which hire matters most.", "Ada says the designer first.", "Hire one now, the second in summer.", "Ada&#x27;s draft adds two hires."];
    const at = order.map((text) => html.indexOf(text));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain("Proposal for your stand");
    expect(html).toContain("Why: Travel was a third of last year&#x27;s spend.");
    expect(html).toContain(">kept<");
    expect(html).toContain(">open<");
    expect(html).toContain("Take it as my stand");
    const rail = html.slice(html.indexOf('class="stside"'));
    expect(rail).toContain("Ada Lovelace");
    expect(rail).toContain('href="https://example.org/brief"');
    expect(html.indexOf('class="stmain"')).toBeLessThan(html.indexOf('class="stside"'));
  });

  test("an open stand or idea offers keep, discuss and dismiss; a plain note or a kept one does not", () => {
    expect(open().match(/>Dismiss</g)?.length).toBe(1);
    const idea = { ...budgetThread, notes: budgetThread.notes.map((n) => (n.kind === "idea" ? { ...n, status: "open" as const } : n)) };
    const html = open(idea);
    expect(html.match(/>Dismiss</g)?.length).toBe(2);
    expect(html.match(/>Keep</g)?.length).toBe(1);
    expect(html).toContain("Discuss");
  });

  test("relation notes stay out (F27)", () => {
    expect(open()).not.toContain("This relates to the March offsite.");
    expect(timeline(budgetThread).some((e) => "note" in e && e.note.kind === "relation")).toBe(false);
  });

  test("it offers the response field and the thread acts, in German too", () => {
    const en = open();
    for (const label of ["Your answer to the assistant", "Think it over tonight", "Close with an outcome", ">Park<"]) expect(en).toContain(label);
    const de = open(undefined, "de");
    for (const label of ["Wo ich stehe", "Deine Antwort an den Assistenten", "Heute Nacht durchdenken", "Parken", "Als Standpunkt übernehmen"]) expect(de).toContain(label);
  });

  test("its rail offers sparring, with a question per persona Cortex lists and without one when it lists none", () => {
    const html = open(budgetThread, "en", ["Grace Hopper"]);
    const rail = html.slice(html.indexOf('class="stside"'));
    expect(rail).toContain("Sparring");
    for (const label of ["Think now", "Grill me", "Argue the other side", "Red team", "First principles"]) expect(rail).toContain(`>${label}<`);
    expect(rail).toContain("What would Grace Hopper say?");
    expect(open()).not.toContain("What would");
  });

  test("a parked thread offers to bring it back", () => {
    const html = open({ ...budgetThread, state: "parked" });
    expect(html).toContain("Bring back");
    expect(html).toContain("Parked");
  });
});

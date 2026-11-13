import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient, type Fetch } from "../src/ui/api/client";
import { QueueContext } from "../src/ui/cards/act";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { buildQueue, EMPTY_SESSION, openStudio, skip } from "../src/ui/queue/order";
import { sendStudioAct, STUDIO_ACT_PATH } from "../src/ui/studio/act";
import { closeAct, StudioCard, timeline } from "../src/ui/studio/card";
import { NOW, view } from "./fixtures/desk";
import { budgetThread, studioList } from "./fixtures/studio";

const render = (open: boolean, locale: "en" | "de" = "en", thread = budgetThread) =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <QueueContext.Provider value={{ client: createClient(async () => new Response("{}")), refresh: () => {} }}>
        <StudioCard thread={thread} waits open={open} onOpen={() => {}} onHide={() => {}} />
      </QueueContext.Provider>
    </I18nProvider>,
  );

describe("the Studio card", () => {
  test("closed, it shows the question, its turn and a way to open it", () => {
    const html = render(false);
    expect(html).toContain("What goes into next year&#x27;s budget?");
    expect(html).toContain("Your turn");
    expect(html).toContain(">Open<");
    expect(html).not.toContain("stgrid");
  });

  test("open, it shows the stand, the notes and responses in time order, and the material in the rail", () => {
    const html = render(true);
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
    expect(render(true).match(/>Dismiss</g)?.length).toBe(1);
    const idea = { ...budgetThread, notes: budgetThread.notes.map((n) => (n.kind === "idea" ? { ...n, status: "open" as const } : n)) };
    const html = render(true, "en", idea);
    expect(html.match(/>Dismiss</g)?.length).toBe(2);
    expect(html.match(/>Keep</g)?.length).toBe(1);
    expect(html).toContain("Discuss");
  });

  test("relation notes stay out (F27)", () => {
    expect(render(true)).not.toContain("This relates to the March offsite.");
    expect(timeline(budgetThread).some((e) => "note" in e && e.note.kind === "relation")).toBe(false);
  });

  test("it offers the response field and the thread acts, in German too", () => {
    const en = render(true);
    for (const label of ["Your answer to the assistant", "Think it over tonight", "Close with an outcome", ">Park<"]) expect(en).toContain(label);
    const de = render(true, "de");
    for (const label of ["Wo ich stehe", "Deine Antwort an den Assistenten", "Heute Nacht durchdenken", "Parken", "Als Standpunkt übernehmen"]) expect(de).toContain(label);
  });

  test("a parked thread offers to bring it back", () => {
    const html = render(true, "en", { ...budgetThread, state: "parked" });
    expect(html).toContain("Bring back");
    expect(html).toContain("Parked");
  });
});

describe("closeAct", () => {
  const base = { text: " It merges into the Desk. ", expect: "", reviewOn: "" };

  test("a decision needs what you expect and a review date", () => {
    expect(closeAct("t", { ...base, outcome: "decided" })).toBeNull();
    expect(closeAct("t", { ...base, outcome: "decided", expect: "I use it daily." })).toBeNull();
    expect(closeAct("t", { ...base, outcome: "decided", expect: " I use it daily. ", reviewOn: "2026-12-15" })).toEqual({
      act: "close",
      thread: "t",
      outcome: "decided",
      text: "It merges into the Desk.",
      expect: "I use it daily.",
      reviewOn: "2026-12-15",
    });
  });

  test("done or dropped needs only the text, and sends no expectation", () => {
    expect(closeAct("t", { ...base, outcome: "dropped", expect: "ignored", reviewOn: "2026-12-15" })).toEqual({ act: "close", thread: "t", outcome: "dropped", text: "It merges into the Desk." });
    expect(closeAct("t", { ...base, text: "  ", outcome: "shipped" })).toBeNull();
  });
});

describe("sendStudioAct", () => {
  test("posts the act with a request id Cortex accepts", async () => {
    const seen: { path: string; body: unknown }[] = [];
    const fetchStub: Fetch = async (path, init) => {
      seen.push({ path, body: JSON.parse(String(init?.body)) });
      return Response.json({ ok: true, message: "Your answer is in." });
    };
    const result = await sendStudioAct(createClient(fetchStub), { act: "respond", thread: "budget-next-year", text: "One hire waits." });
    expect(result.ok).toBe(true);
    expect(seen[0]?.path).toBe(STUDIO_ACT_PATH);
    const body = seen[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ act: "respond", thread: "budget-next-year", text: "One hire waits." });
    expect(String(body.requestId)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  test("sends a note act with the note's time as its identifier", async () => {
    let body: unknown;
    const fetchStub: Fetch = async (_path, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ ok: true });
    };
    await sendStudioAct(createClient(fetchStub), { act: "keep", thread: "budget-next-year", note: "2026-11-13T03:14:00Z" }, "req-12345678");
    expect(body).toEqual({ act: "keep", thread: "budget-next-year", note: "2026-11-13T03:14:00Z", requestId: "req-12345678" });
  });

  test("returns Cortex's error text", async () => {
    const fetchStub: Fetch = async () => Response.json({ ok: false, error: "The Studio has uncommitted changes." }, { status: 409 });
    const result = await sendStudioAct(createClient(fetchStub), { act: "park", thread: "budget-next-year" });
    expect(result).toEqual({ ok: false, message: "The Studio has uncommitted changes.", status: 409 });
  });
});

describe("an open Studio card in the queue", () => {
  const answered = { ...budgetThread, responses: [...budgetThread.responses, { at: "2026-11-13T21:00:00Z", text: "One hire waits." }] };

  test("stays first while open, also after it stops waiting", () => {
    const session = openStudio(EMPTY_SESSION, "budget-next-year");
    const queue = buildQueue(view(), studioList([answered]), session, NOW);
    expect(queue[0]).toMatchObject({ k: "t:budget-next-year", type: "thread", waits: false });
    expect(buildQueue(view(), studioList([answered]), EMPTY_SESSION, NOW)).toEqual([]);
  });

  test("stays after it is parked, and Not now lets it go", () => {
    const session = openStudio(EMPTY_SESSION, "budget-next-year");
    const parked = { ...budgetThread, state: "parked" as const };
    expect(buildQueue(view(), studioList([], [parked]), session, NOW)[0]?.k).toBe("t:budget-next-year");
    expect(skip(session, "t:budget-next-year").open).toBeNull();
  });
});

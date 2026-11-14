import { describe, expect, test } from "bun:test";
import { act, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient, type Fetch } from "../src/ui/api/client";
import type { StudioNote } from "../src/ui/api/types";
import { Desk } from "../src/ui/desk/desk";
import { OpenCard, openPlacement, OPEN_CARD_GAP, OPEN_CARD_MAX, OPEN_CARD_MIN, type Frame } from "../src/ui/desk/open-card";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { STUDIO_ACT_PATH } from "../src/ui/studio/act";
import { budgetThread, studioList } from "./fixtures/studio";
import { inputText, mountDom } from "./fixtures/dom";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const note = budgetThread.notes[0]!;
const stand = budgetThread.notes[2]!;
const noFetch: Fetch = async () => new Response("{}");

const box = (left: number, top: number, width: number, height = 60): Frame => ({ left, top, right: left + width, bottom: top + height, width, height });
const desk = (width: number, height = 900): Frame => box(0, 0, width, height);

describe("where an opened card stands", () => {
  test("a note opens to the right of the notes column, level with its parked card", () => {
    const placed = openPlacement({ desk: desk(1600), card: box(1000, 220, 240), middle: { left: 600, right: 1000 }, side: "right" });
    expect(placed).toEqual({ mode: "out", left: 1000 + 240 + OPEN_CARD_GAP, top: 220, width: 1600 - (1000 + 240 + OPEN_CARD_GAP) });
    expect(placed.left).toBeGreaterThan(1000 + 240);
  });

  test("a material card opens to the left of the material column, level with its parked card", () => {
    const placed = openPlacement({ desk: desk(1600), card: box(360, 120, 240), middle: { left: 600, right: 1000 }, side: "left" });
    expect(placed).toEqual({ mode: "out", left: 0, top: 120, width: 360 - OPEN_CARD_GAP });
    expect(placed.left + placed.width).toBe(360 - OPEN_CARD_GAP);
  });

  test("the opened card is as wide as the space outside its column allows, between 280 and 380 pixels", () => {
    const wide = openPlacement({ desk: desk(2000), card: box(1300, 40, 240), middle: { left: 1000, right: 1300 }, side: "right" });
    expect(wide.width).toBe(OPEN_CARD_MAX);
    // Less than 280 pixels of room: the card keeps its 280 and overlaps its own column.
    const thin = openPlacement({ desk: desk(1400), card: box(1060, 300, 240), middle: { left: 700, right: 1060 }, side: "right" });
    expect(thin).toEqual({ mode: "out", left: 1400 - OPEN_CARD_MIN, top: 300, width: OPEN_CARD_MIN });
    expect(thin.left).toBeGreaterThanOrEqual(1060);
    expect(thin.left + thin.width).toBeLessThanOrEqual(1400);
  });

  test("a column narrower than 280 pixels still stays inside the window and never covers the middle", () => {
    const tight = openPlacement({ desk: desk(1100), card: box(900, 0, 200), middle: { left: 600, right: 900 }, side: "right" });
    expect(tight).toEqual({ mode: "out", left: 900, top: 0, width: 200 });
    expect(tight.left).toBeGreaterThanOrEqual(900);
    expect(tight.left + tight.width).toBeLessThanOrEqual(1100);
  });

  test("where the zones stack, the card opens in place, directly below its parked card and as wide as the zone", () => {
    expect(openPlacement({ desk: desk(800), card: box(16, 1000, 768, 70), middle: { left: 16, right: 784 }, side: "right" }))
      .toEqual({ mode: "stack", left: 16, top: 1000 + 70 + OPEN_CARD_GAP, width: 768 });
    expect(openPlacement({ desk: desk(800), card: box(16, 1400, 768, 70), middle: { left: 16, right: 784 }, side: "left" }).mode).toBe("stack");
  });

  test("a card that moves keeps its opened card level, because the placement is read afresh", () => {
    const before = openPlacement({ desk: desk(1600), card: box(1000, 220, 240), middle: { left: 600, right: 1000 }, side: "right" });
    const after = openPlacement({ desk: desk(1600), card: box(1000, 360, 240), middle: { left: 600, right: 1000 }, side: "right" });
    expect(after.top).toBe(360);
    expect(after.left).toBe(before.left);
  });
});

const markup = (element: ReactNode, locale: "en" | "de" = "en") =>
  renderToStaticMarkup(<I18nProvider value={createI18n(locale)}>{element}</I18nProvider>);

const openNote = (extra: Partial<StudioNote> = {}, locale: "en" | "de" = "en") =>
  markup(<OpenCard thing={{ side: "right", id: note.at, note: { ...note, ...extra } }} slug={budgetThread.slug} now={NOW} onClose={() => {}} run={async () => ({ ok: true, data: {} })} />, locale);

describe("an opened note", () => {
  test("shows the whole text as Markdown, how long ago it was written, and the trigger and model behind Details", () => {
    const html = openNote({ text: "**Ada's draft** adds two hires.\n\n- one now\n- one in summer" });
    expect(html).toContain("<strong>Ada&#x27;s draft</strong>");
    expect(html).toContain("<li><p>one now</p></li>");
    expect(html).toContain("<li><p>one in summer</p></li>");
    expect(html).toContain("15 h ago");
    expect(html).toContain("<details");
    expect(html).toContain("<summary>Details</summary>");
    expect(html).toContain("Trigger: Sample thread");
    expect(html).toContain("Model: sample");
  });

  test("an open note asks for a one-line answer; a stand or an idea also takes Keep and Dismiss", () => {
    expect(openNote()).toContain('placeholder="Answer in a sentence. Enter sends."');
    expect(openNote()).not.toContain(">Keep<");
    expect(openNote()).not.toContain("Dismiss");
    expect(openNote({ kind: "stand", status: "open" })).toContain("Take it as my stand");
    expect(openNote({ kind: "idea", status: "open" })).toContain(">Keep<");
    expect(openNote({ kind: "idea", status: "open" })).toContain(">Dismiss<");
  });

  test("a kept note has no answer field and no acts", () => {
    const html = openNote({ status: "kept", kind: "idea" });
    expect(html).not.toContain("<input");
    expect(html).not.toContain(">Dismiss<");
  });

  test("is German too", () => {
    const html = openNote({}, "de");
    expect(html).toContain("<summary>Details</summary>");
    expect(html).toContain("Auslöser: Sample thread");
    expect(html).toContain("Modell: sample");
    expect(html).toContain("In einem Satz antworten. Enter sendet.");
    expect(html).toContain("Zurücklegen");
  });
});

describe("an opened material card", () => {
  const card = (href?: string, locale: "en" | "de" = "en") =>
    markup(<OpenCard thing={{ side: "left", id: "m0", material: { kind: "file", label: "BRIEF.md", href } }} slug={budgetThread.slug} now={NOW} onClose={() => {}} run={async () => ({ ok: true, data: {} })} />, locale);

  test("shows its label, its kind and the link when the href is safe", () => {
    const html = card("https://example.org/brief");
    expect(html).toContain("BRIEF.md");
    expect(html).toContain("file");
    expect(html).toContain('href="https://example.org/brief"');
  });

  test("leaves an unsafe link as text", () => {
    const html = card("javascript:alert(1)");
    expect(html).toContain("BRIEF.md");
    expect(html).not.toContain("<a ");
  });
});

async function withDesk(run: (container: HTMLElement, click: (id: string) => Promise<void>, again: (element: ReactNode) => Promise<void>) => Promise<void>, fetchImpl: Fetch = noFetch) {
  const { root, container, cleanup } = mountDom();
  let refreshed = 0;
  const show = async (element: ReactNode) => { await act(async () => { root.render(element); }); };
  const deskElement = (studio = studioList([budgetThread])) => (
    <I18nProvider value={createI18n("en")}>
      <Desk client={createClient(fetchImpl)} refresh={() => { refreshed += 1; }} studio={studio} slug={budgetThread.slug} backLabel="Back" onBack={() => {}} now={NOW} />
    </I18nProvider>
  );
  const click = async (id: string) => {
    const button = container.querySelector(`[data-desk-card="${id}"]`) as HTMLButtonElement | null;
    if (!button) throw new Error(`no parked card ${id}`);
    await act(async () => { button.click(); });
  };
  try {
    await show(deskElement());
    await run(container, click, show);
  } finally {
    await cleanup();
  }
  return { refreshed: () => refreshed };
}

/** Patches a box onto an element, the way a browser would report it. */
function place(element: Element, b: Frame) {
  Object.defineProperty(element, "getBoundingClientRect", { configurable: true, value: () => ({ ...b, x: b.left, y: b.top, toJSON: () => b }) });
}

const opened = (container: HTMLElement, side: "left" | "right") => container.querySelector(`[data-desk-opened="${side}"]`) as HTMLElement | null;

describe("a click on a parked card", () => {
  test("opens the card at full size outside its column and dims the parked card in place", async () => {
    await withDesk(async (container, click) => {
      await click(note.at);
      const card = opened(container, "right");
      expect(card).not.toBeNull();
      expect(card!.textContent).toContain("Ada's draft adds two hires.");
      const parked = container.querySelector(`[data-desk-card="${note.at}"]`) as HTMLButtonElement;
      expect(parked.getAttribute("aria-expanded")).toBe("true");
      expect(parked.className).toContain("desk-held");
      expect(parked.nextElementSibling).toBe(card);
    });
  });

  test("a second click, Put back and Escape each close it", async () => {
    await withDesk(async (container, click) => {
      await click(stand.at);
      expect(opened(container, "right")).not.toBeNull();
      await click(stand.at);
      expect(opened(container, "right")).toBeNull();

      await click(stand.at);
      const putBack = Array.from(opened(container, "right")!.querySelectorAll("button")).find((button) => button.textContent === "Put back")!;
      await act(async () => { putBack.click(); });
      expect(opened(container, "right")).toBeNull();

      await click(note.at);
      await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" })); });
      expect(opened(container, "right")).toBeNull();
    });
  });

  test("one card is open per side, and opening another puts the first back", async () => {
    await withDesk(async (container, click) => {
      await click(note.at);
      await click(stand.at);
      expect(container.querySelectorAll("[data-desk-opened]")).toHaveLength(1);
      expect(opened(container, "right")!.textContent).toContain("Hire one now, the second in summer.");
      expect((container.querySelector(`[data-desk-card="${note.at}"]`) as HTMLElement).getAttribute("aria-expanded")).toBe("false");
      await click("m0");
      expect(container.querySelectorAll("[data-desk-opened]")).toHaveLength(2);
      expect(opened(container, "left")!.textContent).toContain("Ada Lovelace");
    });
  });

  test("stays level with its parked card when the card moves, and follows the window", async () => {
    await withDesk(async (container, click) => {
      await click(note.at);
      const grid = container.querySelector(".desk-grid")!;
      const middle = container.querySelector('[data-desk="middle"]')!;
      const parked = container.querySelector(`[data-desk-card="${note.at}"]`)!;
      place(grid, box(0, 0, 1600, 900));
      place(middle, box(600, 0, 400, 900));
      place(parked, box(1000, 220, 240));
      await act(async () => { window.dispatchEvent(new window.Event("resize")); });
      let card = opened(container, "right")!;
      expect([card.style.left, card.style.top, card.style.width]).toEqual(["1252px", "220px", "348px"]);

      place(parked, box(1000, 360, 240));
      await act(async () => { window.dispatchEvent(new window.Event("resize")); });
      card = opened(container, "right")!;
      expect(card.style.top).toBe("360px");
    });
  });
});

describe("acts on an opened note", () => {
  test("Keep sends keep and closes the card, and the desk refreshes", async () => {
    const posts: { path: string; body: Record<string, unknown> }[] = [];
    const wired = await withDesk(async (container, click) => {
      await click(stand.at);
      const keep = Array.from(opened(container, "right")!.querySelectorAll("button")).find((button) => button.textContent === "Take it as my stand")!;
      await act(async () => { keep.click(); });
      expect(opened(container, "right")).toBeNull();
    }, async (path, init) => {
      posts.push({ path, body: JSON.parse(String(init?.body)) });
      return Response.json({ ok: true, message: "Kept. Your stand changed." });
    });
    expect(posts).toHaveLength(1);
    expect(posts[0]?.path).toBe(STUDIO_ACT_PATH);
    expect(posts[0]?.body).toMatchObject({ act: "keep", thread: budgetThread.slug, note: stand.at });
    expect(String(posts[0]?.body.requestId)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(wired.refreshed()).toBe(1);
  });

  test("Dismiss sends dismiss", async () => {
    let body: Record<string, unknown> = {};
    await withDesk(async (container, click) => {
      await click(stand.at);
      const dismiss = Array.from(opened(container, "right")!.querySelectorAll("button")).find((button) => button.textContent === "Dismiss")!;
      await act(async () => { dismiss.click(); });
      expect(opened(container, "right")).toBeNull();
    }, async (_path, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ ok: true, message: "Dismissed." });
    });
    expect(body).toMatchObject({ act: "dismiss", thread: budgetThread.slug, note: stand.at });
  });

  test("a finished act closes only its own card, not one opened while it was in flight", async () => {
    let release!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    await withDesk(async (container, click) => {
      await click(stand.at);
      const keep = Array.from(opened(container, "right")!.querySelectorAll("button")).find((button) => button.textContent === "Take it as my stand")!;
      await act(async () => { keep.click(); });

      // While the act is still in flight, open another note and start a draft there.
      await click(note.at);
      const field = opened(container, "right")!.querySelector("input") as HTMLInputElement;
      await inputText(field, "Keep drafting.");

      await act(async () => { release(Response.json({ ok: true, message: "Kept." })); await pending; });

      const card = opened(container, "right");
      expect(card).not.toBeNull();
      expect(card!.textContent).toContain("Ada's draft adds two hires.");
      expect((card!.querySelector("input") as HTMLInputElement).value).toBe("Keep drafting.");
    }, async () => pending);
  });

  test("Enter on the answer field sends respond with what was typed", async () => {
    let body: Record<string, unknown> = {};
    const wired = await withDesk(async (container, click) => {
      await click(note.at);
      const field = opened(container, "right")!.querySelector("input") as HTMLInputElement;
      await inputText(field, "One hire now, the second in summer.");
      await act(async () => { field.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true })); });
      expect(opened(container, "right")).toBeNull();
    }, async (_path, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ ok: true, message: "Answered." });
    });
    expect(body).toMatchObject({ act: "respond", thread: budgetThread.slug, text: "One hire now, the second in summer." });
    expect(wired.refreshed()).toBe(1);
  });

  test("a refused act shows Cortex's message on the card and keeps the typed text", async () => {
    const refused = "This note is no longer open. Nothing was written.";
    const wired = await withDesk(async (container, click) => {
      await click(note.at);
      const field = opened(container, "right")!.querySelector("input") as HTMLInputElement;
      await inputText(field, "One hire now.");
      await act(async () => { field.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true })); });
      const card = opened(container, "right");
      expect(card).not.toBeNull();
      expect(card!.textContent).toContain(refused);
      expect((card!.querySelector("input") as HTMLInputElement).value).toBe("One hire now.");
    }, async () => Response.json({ error: refused }, { status: 409 }));
    expect(wired.refreshed()).toBe(0);
  });
});

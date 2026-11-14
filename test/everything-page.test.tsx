import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "../src/ui/api/client";
import { pathTo } from "../src/ui/everything/moves";
import { EverythingView } from "../src/ui/everything/view";
import { NoteSaver, detailsOf, keepPlace, keptPlace, pageLine, wordCount, type NoteNotice, type SaveTimer } from "../src/ui/everything/note";
import { NotePage } from "../src/ui/everything/page";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { DATE, outlineClient, outlineFixture, row } from "./fixtures/outline";

describe("what a page says about its text", () => {
  test("counts words, not Markdown marks, and is quiet about an empty page", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("##")).toBe(0);
    expect(wordCount("   \n\n  ")).toBe(0);
    expect(wordCount("## Plan")).toBe(1);
    expect(wordCount("A **bold** and *italic* line of `code`.")).toBe(7);
    expect(wordCount("well-known fact, 2 things")).toBe(4);
    expect(pageLine("", createI18n("en"))).toBeNull();
    expect(pageLine("##\n", createI18n("en"))).toBe("page · 0 words");
    expect(pageLine("## Plan\n\n- one\n- two", createI18n("en"))).toBe("page · 3 words");
    expect(pageLine("Plan", createI18n("de"))).toBe("Seite · 1 Wort");
  });

  test("the details sent back are the row's own, unchanged, with the page as the only new value", () => {
    const detail = row("due", {
      title: "Write the script", weight: 45, ordering: "sequential", dueDate: DATE, context: "studio",
      effort: 2, estimateMinutes: 30, focusMonth: "2026-11", note: "old page",
      children: [row("child", { title: "Inside" })],
    });
    expect(detailsOf(detail, DATE, "## Plan")).toEqual({
      title: "Write the script", weight: 45, note: "## Plan", ordering: "sequential",
      focus: true, dueDate: DATE, context: "studio", effort: 2, estimateMinutes: 30,
    });
    expect(detailsOf(row("plain"), DATE, "text")).toEqual({
      title: "plain", weight: 50, note: "text", ordering: "parallel",
      focus: false, dueDate: "", context: "", effort: 1, estimateMinutes: null,
    });
    expect(detailsOf({ ...detail, focusMonth: "2026-10" }, DATE, "").focus).toBe(false);
    expect(detailsOf({ ...detail, dueDate: undefined, context: undefined, estimateMinutes: undefined }, DATE, ""))
      .toMatchObject({ dueDate: "", context: "", estimateMinutes: null, effort: 2 });
  });

  test("the cursor place is kept per row and dropped once it no longer fits the text", () => {
    const kept = new Map<string, string>();
    const store = {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => { kept.set(key, value); },
      removeItem: (key: string) => { kept.delete(key); },
    };
    expect(keptPlace(store, "plain", 100)).toBeNull();
    keepPlace(store, "plain", 12);
    keepPlace(store, "due", 3);
    expect(keptPlace(store, "plain", 100)).toBe(12);
    expect(keptPlace(store, "due", 100)).toBe(3);
    expect(keptPlace(store, "plain", 4)).toBeNull();
    expect(kept.size).toBe(1);
    keepPlace(store, "plain", 5);
    kept.set([...kept.keys()].find(key => key.endsWith(".plain"))!, "not a place");
    expect(keptPlace(store, "plain", 100)).toBeNull();
  });
});

/** A timer the test fires by hand, so the pause is checked without waiting. */
function fakeTimer() {
  let armed: { callback: () => void } | null = null;
  const delays: number[] = [];
  let cancelled = 0;
  const timer: SaveTimer = {
    after: (callback, ms) => { delays.push(ms); armed = { callback }; return "handle"; },
    cancel: () => { cancelled++; armed = null; },
  };
  return {
    timer,
    delays,
    get cancelled() { return cancelled; },
    get waiting() { return armed !== null; },
    fire: () => { const due = armed; armed = null; due?.callback(); },
  };
}

const drain = async () => { for (let tick = 0; tick < 8; tick++) await Promise.resolve(); };

interface Sent { row: string; note: string; revision: number }

function saverFor(replies: ((sent: Sent) => { ok: true; revision: number } | { ok: false; message: string | null })[] = []) {
  const sent: Sent[] = [];
  const notices: NoteNotice[] = [];
  const reloads = { count: 0, revision: 99 };
  let revision = 12;
  const outline = outlineFixture();
  const notes = new Map<string, string>();
  const fake = fakeTimer();
  const saver = new NoteSaver({
    timer: fake.timer,
    save: async (detail, note, at, date) => {
      expect(date).toBe(DATE);
      sent.push({ row: detail.id, note, revision: at });
      notes.set(detail.id, note);
      const reply = replies.shift();
      const result = reply ? reply({ row: detail.id, note, revision: at }) : { ok: true as const, revision: at + 1 };
      if (result.ok) revision = result.revision;
      return result;
    },
    reload: async () => { reloads.count++; return reloads.revision; },
    row: id => outline.outline ? { ...(row(id, { note: notes.get(id) })) } : null,
    date: () => DATE,
    revision: () => revision,
    notice: notice => notices.push(notice),
  });
  return { saver, sent, notices, fake, reloads, notes };
}

describe("saving a page", () => {
  test("saves 1.2 seconds after typing pauses, on the revision it was made on, then on the returned one", async () => {
    const { saver, sent, notices, fake } = saverFor();
    saver.type("due", "## Pl");
    expect(fake.delays).toEqual([1200]);
    expect(sent).toEqual([]);
    saver.type("due", "## Plan");
    expect(fake.delays).toEqual([1200, 1200]);
    expect(fake.cancelled).toBe(1);
    expect(sent).toEqual([]);
    fake.fire();
    await drain();
    expect(sent).toEqual([{ row: "due", note: "## Plan", revision: 12 }]);
    expect(notices).toEqual([{ row: "due", state: "saved", message: null }]);
    expect(saver.waiting).toEqual([]);
    saver.type("due", "## Plan\n\n**bold**");
    fake.fire();
    await drain();
    expect(sent.at(-1)).toEqual({ row: "due", note: "## Plan\n\n**bold**", revision: 13 });
  });

  test("losing focus saves at once without waiting for the pause", async () => {
    const { saver, sent, fake } = saverFor();
    saver.type("due", "typed");
    saver.leave("due", "typed and then left");
    expect(fake.waiting).toBe(false);
    await drain();
    expect(sent).toEqual([{ row: "due", note: "typed and then left", revision: 12 }]);
  });

  test("a refusal keeps the text, shows Cortex's message and retries on the newest revision", async () => {
    const { saver, sent, notices, reloads } = saverFor([() => ({ ok: false, message: "The outline changed in another window or source. Your draft is kept; reload the latest outline before saving again." })]);
    saver.leave("due", "kept text");
    await drain();
    expect(notices).toEqual([{ row: "due", state: "refused", message: "The outline changed in another window or source. Your draft is kept; reload the latest outline before saving again." }]);
    expect(saver.waiting).toEqual([{ row: "due", text: "kept text" }]);
    expect(reloads).toEqual({ count: 1, revision: 99 });
    saver.leave("due", "kept text");
    await drain();
    expect(sent).toEqual([{ row: "due", note: "kept text", revision: 12 }, { row: "due", note: "kept text", revision: 99 }]);
    expect(saver.waiting).toEqual([]);
  });

  test("text typed in one row is saved to that row when another row is opened", async () => {
    const { saver, sent } = saverFor();
    saver.type("due", "on the due row");
    saver.type("plain", "on the plain row");
    await saver.flush();
    expect(sent).toEqual([{ row: "due", note: "on the due row", revision: 12 }, { row: "plain", note: "on the plain row", revision: 13 }]);
    expect(saver.waiting).toEqual([]);
  });

  test("does not save text that is already saved, even when the editor leaves again", async () => {
    const { saver, sent, notices } = saverFor();
    saver.type("due", "same page");
    await saver.flush();
    expect(sent).toEqual([{ row: "due", note: "same page", revision: 12 }]);
    saver.leave("due", "same page");
    await drain();
    expect(sent).toHaveLength(1);
    expect(notices).toEqual([{ row: "due", state: "saved", message: null }]);
  });

  test("takes a reloaded note as saved unless a draft is in hand", async () => {
    const { saver, sent } = saverFor();
    saver.adopt("due", "from elsewhere");
    saver.leave("due", "from elsewhere");
    await drain();
    expect(sent).toEqual([]);
    saver.type("due", "my draft");
    saver.adopt("due", "from elsewhere");
    saver.leave("due", "my draft");
    await drain();
    expect(sent).toEqual([{ row: "due", note: "my draft", revision: 12 }]);
  });
});

describe("the page surface", () => {
  test("the quiet line shows the word count, the ceiling above 8,000 characters and the save", () => {
    const rowOf = row("due", { title: "Write the script" });
    const quiet = (text: string, notice: NoteNotice | null = null) =>
      renderToStaticMarkup(<NotePage row={rowOf} text={text} place={null} notice={notice} onType={() => {}} onLeave={() => {}} />);
    expect(quiet("## Plan\n\n**bold** words")).toContain("3 words");
    expect(quiet("## Plan\n\n**bold** words")).not.toContain("of 10,000 characters");
    expect(quiet("x".repeat(8_001))).toContain("1 word · 8,001 of 10,000 characters");
    expect(quiet("word ", { row: "due", state: "saved", message: null })).toContain("saved");
    expect(quiet("", { row: "due", state: "saved", message: null })).toContain("0 words");
    const refused = quiet("kept text", { row: "due", state: "refused", message: "Cortex refused this save." });
    expect(refused).toContain("2 words");
    expect(refused).toContain("Cortex refused this save.");
    expect(refused).not.toContain("role=\"alert\"");
  });

  test("a row with a note says on its line that a page exists and how many words it has, after the time", () => {
    const fixture = outlineFixture();
    fixture.outline.children[0]!.note = "## Plan\n\nWrite **bold** words";
    const html = renderToStaticMarkup(<EverythingView client={createClient()} initialDay={fixture} />);
    expect(html).toContain('<span class="outline-page">page · 4 words</span>');
    const summary = html.indexOf("3 open");
    expect(summary).toBeGreaterThan(-1);
    expect(html.indexOf("page · 4 words")).toBeGreaterThan(summary);
    fixture.outline.children[0]!.note = "Plan";
    const german = renderToStaticMarkup(<I18nProvider value={createI18n("de")}><EverythingView client={createClient()} initialDay={fixture} /></I18nProvider>);
    expect(german).toContain('<span class="outline-page">Seite · 1 Wort</span>');
  });
});

async function surface(run: (container: HTMLElement, render: (element: React.ReactNode) => Promise<void>) => Promise<void>) {
  const dom = new Window();
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const container = dom.document.createElement("div") as unknown as HTMLElement;
  dom.document.body.append(container as unknown as never);
  const root = createRoot(container);
  try {
    await run(container, async element => { await act(async () => root.render(element)); });
  } finally {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

const click = async (container: HTMLElement, text: string) => {
  const button = Array.from(container.querySelectorAll("button")).find(element => element.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
};

test("text typed on a page is saved to the row it was typed in when another row opens", async () => surface(async (container, render) => {
  const { client, commands } = outlineClient();
  await render(<EverythingView client={client} initialDay={outlineFixture()} />);
  await click(container, "Work");
  await click(container, "Exercise");
  const field = container.querySelector("textarea")!;
  expect(field).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(field, "## Plan\n\nA **bold** line");
    field.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  expect(commands).toEqual([]);
  await click(container, "‹ Work");
  await act(async () => { await Promise.resolve(); });
  expect(commands).toEqual([{
    op: "outline-edit", revision: 12, id: "project", yes: false,
    details: { title: "Exercise", weight: 50, note: "## Plan\n\nA **bold** line", ordering: "parallel", focus: false, dueDate: "", context: "", effort: 1, estimateMinutes: null },
  }]);
  expect(container.querySelector('[data-row="project"] .outline-page')?.textContent).toBe("page · 4 words");
}));

test("a reloaded page from another source replaces a saved draft when the row is reopened", async () => surface(async (container, render) => {
  const { day, client, commands } = outlineClient();
  await render(<EverythingView client={client} active={false} />);
  await render(<EverythingView client={client} active={true} />);
  await act(async () => { await drain(); });
  await click(container, "Work");
  await click(container, "Exercise");
  const field = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(field, "## Plan");
    field.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click(container, "‹ Work");
  await act(async () => { await drain(); });
  expect(commands).toHaveLength(1);
  pathTo(day.outline, "project")!.at(-1)!.note = "## Plan from elsewhere";
  day.revision += 1;
  await render(<EverythingView client={client} active={false} />);
  await render(<EverythingView client={client} active={true} />);
  await act(async () => { await drain(); });
  await click(container, "Exercise");
  const reopened = container.querySelector("textarea")!;
  expect(reopened.value).toBe("## Plan from elsewhere");
  await click(container, "‹ Work");
  await act(async () => { await drain(); });
  expect(commands).toHaveLength(1);
}));

test("typing after a save clears the saved line", async () => surface(async (container, render) => {
  const { client } = outlineClient();
  await render(<EverythingView client={client} initialDay={outlineFixture()} />);
  await click(container, "Work");
  await click(container, "Exercise");
  const field = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(field, "## Plan");
    field.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await act(async () => { field.focus(); field.blur(); await drain(); });
  expect(container.querySelector(".note-line")?.textContent).toContain("saved");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(field, "## Plan\n\nmore");
    field.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  expect(container.querySelector(".note-line")?.textContent).not.toContain("saved");
}));

test("a reload after a save shows the reloaded page while its row stays open", async () => surface(async (container, render) => {
  const { day, client, commands } = outlineClient();
  await render(<EverythingView client={client} initialDay={outlineFixture()} />);
  await click(container, "Work");
  await click(container, "Exercise");
  const field = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(field, "## Plan");
    field.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await act(async () => { field.focus(); field.blur(); await drain(); });
  expect(commands).toHaveLength(1);
  // Another source writes the same row's note while its page is still open here.
  pathTo(day.outline, "project")!.at(-1)!.note = "## Plan from elsewhere";
  day.revision += 1;
  await render(<EverythingView client={client} active={false} />);
  await render(<EverythingView client={client} active={true} />);
  await act(async () => { await drain(); });
  expect(container.querySelector(".cur h2")?.textContent).toBe("Exercise");
  const shown = container.querySelector("textarea")!;
  expect(shown.value).toBe("## Plan from elsewhere");
  // Leaving the reloaded page sends the reloaded text, not the one that was saved before it.
  await act(async () => { shown.focus(); shown.blur(); await drain(); });
  expect(commands).toHaveLength(1);
}));

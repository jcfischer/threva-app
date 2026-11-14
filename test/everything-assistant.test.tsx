import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { EditorView } from "@codemirror/view";
import { createClient } from "../src/ui/api/client";
import { AssistantNotes, askAssistant, findPassage, layoutNotes, lineAbove, pageAfterKeep, pageAfterReplace, type OpenNote } from "../src/ui/everything/assistant";
import { NotePage } from "../src/ui/everything/page";
import { row } from "./fixtures/outline";

const memoryStorage = () => {
  const kept = new Map<string, string>();
  return { kept, getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => { kept.set(key, value); }, removeItem: (key: string) => { kept.delete(key); } };
};
const note = (extra: Partial<OpenNote> = {}): OpenNote => ({ id: "n1", kind: "answer", question: "what is missing?", passage: "The plan", reply: "Add a date.\n\nAnd an owner.", at: "2026-11-14T10:00:00Z", ...extra });

describe("the page seam", () => {
  test("finds a passage by its quoted text and the nearest line with text above a line", () => {
    expect(findPassage("One\nThe plan\nTwo", "The plan")).toEqual({ from: 4, to: 12 });
    expect(findPassage("One\n The plan \nTwo", " The plan\n")).toEqual({ from: 5, to: 13 });
    expect(findPassage("One", "Gone")).toBeNull();
    expect(findPassage("One", null)).toBeNull();
    expect(lineAbove("A\n\n  B  \n\n/ q", 11)).toBe("B");
    expect(lineAbove("/ q", 0)).toBeNull();
  });

  test("Keep writes a marked quote below the line of the passage, or at the end when it is gone", () => {
    expect(pageAfterKeep("The plan\nNext", note(), "Mira", "2026-11-14")).toBe("The plan\n\n> **Mira, 2026-11-14**\n> Add a date.\n>\n> And an owner.\n\nNext");
    expect(pageAfterKeep("The plan", note(), "Mira", "2026-11-14")).toBe("The plan\n\n> **Mira, 2026-11-14**\n> Add a date.\n>\n> And an owner.");
    expect(pageAfterKeep("The plan\n\nNext", note(), "Mira", "2026-11-14")).toBe("The plan\n\n> **Mira, 2026-11-14**\n> Add a date.\n>\n> And an owner.\n\nNext");
    expect(pageAfterKeep("Other", note(), "Mira", "2026-11-14").startsWith("Other\n\n> **Mira, 2026-11-14**")).toBe(true);
    expect(pageAfterKeep("", note({ passage: null }), "Mira", "2026-11-14")).toBe("> **Mira, 2026-11-14**\n> Add a date.\n>\n> And an owner.");
  });

  test("Replace puts the new text in place of the passage and refuses a passage that is gone", () => {
    const shorter = note({ kind: "shorten", replacement: "Plan" });
    expect(pageAfterReplace("A\nThe plan\nB", shorter)).toBe("A\nPlan\nB");
    expect(pageAfterReplace("A", shorter)).toBeNull();
  });

  test("margin notes stand at their passage, are pushed down when they overlap, and a note without a place stands last", () => {
    const { tops, bottom } = layoutNotes([
      { id: "lost", top: null, height: 20 }, { id: "b", top: 50, height: 40 }, { id: "a", top: 10, height: 50 }, { id: "c", top: 300, height: 10 },
    ]);
    expect(tops).toEqual({ a: 10, b: 68, c: 300, lost: 318 });
    expect(bottom).toBe(338);
    expect(layoutNotes([]).bottom).toBe(0);
  });
});

describe("asking", () => {
  const answer = (body: unknown, status = 200) => {
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    const client = createClient(async (url, init) => { sent.push({ url, body: JSON.parse(init!.body as string) }); return Response.json(body, { status }); });
    return { sent, client };
  };

  test("sends a fresh request id with the line above as passage and reads the reply", async () => {
    const { sent, client } = answer({ ok: true, reply: "Add a date." });
    expect(await askAssistant({ client, row: "r", kind: "answer", question: "what?", passage: "The plan" })).toEqual({ ok: true, reply: "Add a date." });
    await askAssistant({ client, row: "r", kind: "answer", question: "what?", passage: "The plan" });
    expect(sent[0]!.url).toBe("/api/desk/outline/ask");
    expect(sent[0]!.body).toMatchObject({ row: "r", kind: "answer", question: "what?", passage: "The plan" });
    expect(sent[0]!.body.requestId).not.toBe(sent[1]!.body.requestId);
  });

  test("a shorten asks with the passage only and returns the replacement", async () => {
    const { sent, client } = answer({ ok: true, reply: "Shorter.", replacement: "Plan" });
    expect(await askAssistant({ client, row: "r", kind: "shorten", question: "ignored", passage: "The plan" })).toEqual({ ok: true, reply: "Shorter.", replacement: "Plan" });
    expect(Object.keys(sent[0]!.body).sort()).toEqual(["kind", "passage", "requestId", "row"]);
  });

  test("a refusal gives Cortex's own message and an unreadable answer gives none", async () => {
    expect(await askAssistant({ client: answer({ ok: false, error: "No model." }, 503).client, row: "r", kind: "answer", question: "q" })).toEqual({ ok: false, message: "No model." });
    expect(await askAssistant({ client: answer({ ok: true }).client, row: "r", kind: "answer", question: "q" })).toEqual({ ok: false, message: null });
  });
});

describe("open notes", () => {
  test("stay in storage per row until dismissed, and unreadable storage gives none", () => {
    const storage = memoryStorage();
    const notes = new AssistantNotes(storage);
    notes.add("r", note());
    notes.add("r", note({ id: "n2", kind: "shorten", replacement: "Plan" }));
    expect(new AssistantNotes(storage).list("r").map(item => item.id)).toEqual(["n1", "n2"]);
    expect(notes.list("other")).toEqual([]);
    notes.remove("r", "n1");
    expect(notes.list("r").map(item => item.id)).toEqual(["n2"]);
    notes.remove("r", "n2");
    expect(storage.kept.size).toBe(0);
    storage.setItem("threva.everything.assistant.r", "{oops");
    expect(notes.list("r")).toEqual([]);
  });
});

const RICH = ["window", "document", "IS_REACT_ACT_ENVIRONMENT", "MutationObserver", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle", "DOMRect", "Range"];

async function surface(run: (container: HTMLElement, render: (element: React.ReactNode) => Promise<void>) => Promise<void>) {
  const dom = new Window();
  const originals = new Map(RICH.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const name of RICH) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: name === "window" ? dom : name === "document" ? dom.document : name === "IS_REACT_ACT_ENVIRONMENT" ? true : (dom as unknown as Record<string, unknown>)[name] });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try { await run(container, async element => { await act(async () => root.render(element)); }); }
  finally {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

function page(options: { reply?: () => Response | Promise<Response>; storage?: ReturnType<typeof memoryStorage> }) {
  const asks: Record<string, unknown>[] = [];
  const saves: string[] = [];
  const storage = options.storage ?? memoryStorage();
  const client = createClient(async (_url, init) => { asks.push(JSON.parse(init!.body as string)); return options.reply ? options.reply() : Response.json({ ok: true, reply: "Add a date." }); });
  const element = (text: string, assistantName?: string) => <NotePage row={row("r", { title: "Write" })} text={text} place={null} notice={null} client={client} notes={new AssistantNotes(storage)} assistantName={assistantName}
    onType={() => {}} onLeave={next => saves.push(next)} />;
  return { asks, saves, storage, element };
}

const enter = (content: HTMLElement) => content.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

describe("the assistant on a page", () => {
  test("Enter on an addressed line removes it, asks with the line above, keeps the cursor and shows the answer in the margin", async () => surface(async (container, render) => {
    const subject = page({});
    await render(subject.element("The plan\n\n/ what is missing?\nMore", "Mira"));
    const content = container.querySelector<HTMLElement>(".cm-content")!;
    const editor = EditorView.findFromDOM(content)!;
    expect(container.querySelector(".cm-thread-addressed")?.getAttribute("data-hint")).toBe("Enter sends this line to Mira");
    const at = editor.state.doc.line(3).to;
    await act(async () => { editor.focus(); editor.dispatch({ selection: { anchor: at } }); enter(content); });
    expect(editor.state.doc.toString()).toBe("The plan\n\nMore");
    expect(editor.state.selection.main.head).toBe(10);
    await flush();
    expect(subject.asks[0]).toMatchObject({ row: "r", kind: "answer", question: "what is missing?", passage: "The plan" });
    expect(container.querySelector(".assist-note")?.textContent).toContain("Add a date.");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(new AssistantNotes(subject.storage).list("r")).toHaveLength(1);
    expect(container.querySelector(".cm-assist-passage")?.textContent).toBe("The plan");
    expect(editor.state.doc.toString()).toBe("The plan\n\nMore");
  }));

  test("Keep writes the quote into the page and saves it; Dismiss changes nothing and sends nothing", async () => surface(async (container, render) => {
    const storage = memoryStorage();
    const notes = new AssistantNotes(storage);
    notes.add("r", note({ id: "keep" }));
    notes.add("r", note({ id: "drop", passage: "More", reply: "Nope." }));
    const subject = page({ storage });
    await render(subject.element("The plan\nMore", "Mira"));
    const buttons = () => [...container.querySelectorAll<HTMLButtonElement>(".assist-note button")];
    expect(buttons().map(button => button.textContent)).toEqual(["Keep", "Dismiss", "Keep", "Dismiss"]);
    await act(async () => buttons()[3]!.click());
    expect(subject.asks).toHaveLength(0);
    expect(subject.saves).toHaveLength(0);
    expect(notes.list("r").map(item => item.id)).toEqual(["keep"]);
    await act(async () => buttons()[0]!.click());
    const editor = EditorView.findFromDOM(container.querySelector<HTMLElement>(".cm-content")!)!;
    expect(editor.state.doc.toString()).toBe("The plan\n\n> **Mira, " + new Date().toLocaleDateString("sv") + "**\n> Add a date.\n>\n> And an owner.\n\nMore");
    expect(subject.saves.at(-1)).toBe(editor.state.doc.toString());
    expect(container.querySelector(".assist-note")).toBeNull();
    expect(container.querySelector(".cm-assist-quote")).not.toBeNull();
    expect(notes.list("r")).toEqual([]);
  }));

  test("a refused ask shows Cortex's message below the editor and puts the line back", async () => surface(async (container, render) => {
    const subject = page({ reply: () => Response.json({ ok: false, error: "No conversation model is configured." }, { status: 503 }) });
    await render(subject.element("The plan\n/ what?\nMore"));
    const content = container.querySelector<HTMLElement>(".cm-content")!;
    const editor = EditorView.findFromDOM(content)!;
    await act(async () => { editor.focus(); editor.dispatch({ selection: { anchor: editor.state.doc.line(2).to } }); enter(content); });
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("No conversation model is configured.");
    expect(editor.state.doc.toString()).toBe("The plan\n/ what?\nMore");
    expect(container.querySelector(".assist-note")).toBeNull();
  }));

  test("a note with a replacement shows both texts and Replace is disabled when the passage is gone", async () => surface(async (container, render) => {
    const storage = memoryStorage();
    new AssistantNotes(storage).add("r", note({ kind: "shorten", replacement: "Plan", reply: "Shorter." }));
    const subject = page({ storage });
    await render(subject.element("The plan here"));
    expect(container.querySelector(".assist-old")?.textContent).toContain("The plan");
    expect(container.querySelector(".assist-new")?.textContent).toContain("Plan");
    const replace = () => [...container.querySelectorAll<HTMLButtonElement>(".assist-note button")].find(button => button.textContent === "Replace")!;
    expect(replace().disabled).toBe(false);
    await act(async () => replace().click());
    const editor = EditorView.findFromDOM(container.querySelector<HTMLElement>(".cm-content")!)!;
    expect(editor.state.doc.toString()).toBe("Plan here");
    expect(subject.saves.at(-1)).toBe("Plan here");
    new AssistantNotes(storage).add("r", note({ id: "n9", kind: "shorten", replacement: "Plan", passage: "Vanished" }));
    await render(<div>{subject.element("Plan here")}</div>);
    expect(replace().disabled).toBe(true);
  }));
});

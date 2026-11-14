import { expect, test } from "bun:test";
import { act, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorView } from "@codemirror/view";
import { createClient } from "../src/ui/api/client";
import type { MyDayOutline, StudioAct, StudioProject, StudioThread } from "../src/ui/api/types";
import { addressedText } from "../src/ui/everything/addressed";
import { orderedThreadEntries, ThreadPage } from "../src/ui/everything/thread-page";
import { EverythingView } from "../src/ui/everything/view";
import { row } from "./fixtures/outline";
import { CODEMIRROR_GLOBALS, mountDom } from "./fixtures/dom";
import { budgetThread, closedThread, studioList } from "./fixtures/studio";

const mapping: StudioProject = { id: "thread", slug: budgetThread.slug, state: "active", openNotes: 3 };
const noop = () => {};
function day(): MyDayOutline {
  return { date: "2026-11-14", revision: 1, outline: row("root", { title: "Outline", children: [row("area:work", { title: "Work", children: [
    row("thread", { title: budgetThread.question, done: true }),
    row("parked", { title: "Parked thread", done: true, deferredUntil: "2028-01-01" }),
    row("closed", { title: "Closed thread", done: false }),
    row("off", { title: "Unreadable thread", done: true }),
  ] })] }), studioProjects: [{ ...mapping },
    { ...mapping, id: "parked", slug: "parked", state: "parked", openNotes: 0 },
    { ...mapping, id: "closed", slug: "closed", state: "closed", openNotes: 0 },
    { ...mapping, id: "off", slug: "off", state: null, openNotes: null },
  ] };
}

test("the thread's pure page seam orders responses and kept notes, excluding open and dismissed notes", () => {
  const thread: StudioThread = { ...budgetThread, notes: [...budgetThread.notes,
    { at: "2026-11-14T10:00:00Z", kind: "relation", status: "kept", text: "A kept relation" },
    { at: "2026-11-11T10:00:00Z", kind: "idea", status: "dismissed", text: "Dismissed" },
  ] };
  expect(orderedThreadEntries(thread)).toEqual([
    { at: "2026-11-12T03:12:00Z", author: "assistant", text: "Ask Ada which hire matters most." },
    { at: "2026-11-12T09:40:00Z", author: "you", text: "Ada says the designer first." },
    { at: "2026-11-14T10:00:00Z", author: "assistant", text: "A kept relation" },
  ]);
});

test("the recorded Studio fixture reads as one authored page and an open-note margin", () => {
  const html = renderToStaticMarkup(<ThreadPage client={createClient()} project={mapping} initialStudio={studioList([budgetThread])} assistantName="Mira" onChange={noop} />);
  expect(html.indexOf(budgetThread.stand)).toBeLessThan(html.indexOf("Ask Ada which hire matters most."));
  expect(html.indexOf("Ask Ada which hire matters most.")).toBeLessThan(html.indexOf("Ada says the designer first."));
  expect(html).toContain('class="thread-entry thread-kept"');
  expect(html).toContain('dateTime="2026-11-12T03:12:00Z"');
  expect(html).toContain("Mira,");
  expect(html).toContain("You,");
  const margin = html.slice(html.indexOf("<aside"));
  for (const note of budgetThread.notes.filter(note => note.status === "open")) expect(margin).toContain(note.text.replaceAll("'", "&#x27;"));
  expect(margin).toContain("Why: Travel was a third of last year&#x27;s spend.");
  expect(margin).toContain("Relation");
  expect(margin.match(/>Keep</g)).toHaveLength(3);
  expect(margin.match(/>Dismiss</g)).toHaveLength(3);
  expect(html).toContain("Add to the thread");
  expect(html).not.toContain("Close with an outcome");
});

test("closed, absent and unreadable Studio data have no editor; neutral assistant wording is catalog-backed", () => {
  const render = (project: StudioProject, initialStudio = studioList([], [], [closedThread])) => renderToStaticMarkup(<ThreadPage client={createClient()} project={project} initialStudio={initialStudio} onChange={noop} />);
  expect(render({ ...mapping, state: "closed" })).toContain("This thread is closed.");
  expect(render({ ...mapping, state: "closed" })).not.toContain("Add to the thread");
  expect(render({ ...mapping, state: null })).toContain("Studio cannot be read.");
  expect(render(mapping, { studio: null })).toContain("Studio cannot be read.");
  expect(render(mapping, studioList([]))).not.toContain("Add to the thread");
  expect(render(mapping, studioList([budgetThread]))).toContain("the assistant,");
});

test("address marks use the runtime name literally and strip only the leading mark", () => {
  expect(addressedText("/ which one?", null)).toBe("which one?");
  expect(addressedText("  M. [AI], which one?", "M. [AI]")).toBe("which one?");
  expect(addressedText("mira, keep / this", "Mira")).toBe("keep / this");
  expect(addressedText("Mira, which one?", null)).toBeNull();
  expect(addressedText("Ivy, which one?", "Mira")).toBeNull();
  expect(addressedText("An ordinary line / stays", "Mira")).toBeNull();
});

async function surface(run: (container: HTMLElement, render: (element: ReactNode) => Promise<void>) => Promise<void>, rich = false) {
  const { root, container, cleanup } = mountDom(rich ? CODEMIRROR_GLOBALS : []);
  try { await run(container, async element => { await act(async () => root.render(element)); }); }
  finally {
    await cleanup();
  }
}
async function click(container: Element, text: string) {
  const button = [...container.querySelectorAll("button")].find(button => button.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
async function type(container: Element, text: string) {
  const field = container.querySelector("textarea")!;
  await act(async () => {
    field.value = text;
    field.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  return field;
}
function studioClient() {
  const thread = structuredClone(budgetThread);
  const outline = day();
  const acts: StudioAct[] = [];
  let refusal: string | null = null;
  let unavailable = false;
  const client = createClient(async (url, init) => {
    if (url === "/api/desk/my-day") return Response.json(outline);
    if (!init) return unavailable ? Response.json({ error: "Broken Studio" }, { status: 503 }) : Response.json(studioList([thread]));
    expect(url).toBe("/api/desk/studio/act");
    const { requestId, ...body } = JSON.parse(init.body as string);
    expect(requestId).toMatch(/^[a-f0-9]+$/);
    acts.push(body);
    if (refusal) return Response.json({ error: refusal }, { status: 409 });
    if (body.act === "keep" || body.act === "dismiss") {
      thread.notes.find(note => note.at === body.note)!.status = body.act === "keep" ? "kept" : "dismissed";
      outline.studioProjects![0]!.openNotes!--;
    }
    if (body.act === "respond") thread.responses.push({ at: "2026-11-14T11:00:00Z", text: body.text });
    return Response.json({ ok: true, studio: studioList([thread]) });
  });
  return { client, acts, refuse: (message: string | null) => { refusal = message; }, breakStudio: () => { unavailable = true; } };
}

function pendingClient(readable = true) {
  let finish!: (response: Response) => void;
  const client = createClient(async (_url, init) => init
    ? new Promise<Response>(resolve => { finish = resolve; })
    : readable ? Response.json(studioList([budgetThread])) : Response.json({ error: "Studio unreadable" }, { status: 503 }));
  return { client, finish: (response: Response) => finish(response), setReadable: (value: boolean) => { readable = value; } };
}

test("mapped state overrides done and dates, counts include threads, and thread pages have no add or completion field", async () => surface(async (container, render) => {
  const { client } = studioClient();
  await render(<EverythingView client={client} initialDay={day()} assistantName="Mira" />);
  expect(container.textContent).toContain("2 open · 1 later");
  await click(container, "Work");
  expect(container.querySelector('.outline-done [data-row="thread"]')).toBeNull();
  expect(container.querySelector('[data-row="thread"]')!.classList.contains("outline-grey")).toBe(false);
  expect(container.querySelector('[data-row="thread"]')!.textContent).toContain("thread with Mira · 3 notes open");
  expect(container.querySelector('[data-row="thread"]')!.textContent).not.toContain("Done");
  expect(container.querySelector('[data-row="parked"]')!.classList.contains("outline-grey")).toBe(true);
  expect(container.querySelector('[data-row="parked"]')!.textContent).toContain("put away");
  expect(container.querySelector('[data-row="parked"]')!.textContent).not.toContain("2028");
  expect(container.querySelector('.outline-done [data-row="closed"]')).not.toBeNull();
  expect(container.querySelector('[data-row="off"]')!.textContent).toContain("thread with Mira");
  expect(container.querySelector('[data-row="off"]')!.textContent).not.toContain("notes open");
  await click(container, budgetThread.question);
  expect(container.querySelector(".thread-page")).not.toBeNull();
  expect(container.querySelector(".outline-add")).toBeNull();
  expect([...container.querySelectorAll("button")].some(button => ["Done", "Later", "Reopen"].includes(button.textContent!))).toBe(false);
  await click(container, "‹ Work");
  await click(container, "Unreadable thread");
  expect(container.textContent).toContain("Studio cannot be read.");
  expect(container.querySelector("textarea")).toBeNull();
}));

test("a missing mapping state stops rendering instead of guessing from done", () => {
  const fixture = day();
  Reflect.deleteProperty(fixture.studioProjects![0]!, "state");
  const html = renderToStaticMarkup(<EverythingView client={createClient()} initialDay={fixture} />);
  expect(html).toContain("The thread mapping is missing its state.");
  expect(html).not.toContain(budgetThread.question);
});

test("Keep and Dismiss use the Studio act client and reload the page and outline count; refusals sit by their buttons", async () => surface(async (container, render) => {
  const memory = studioClient();
  await render(<EverythingView client={memory.client} initialDay={day()} assistantName="Mira" />);
  await click(container, "Work"); await click(container, budgetThread.question);
  const proposal = () => [...container.querySelectorAll(".thread-margin-note")].find(note => note.textContent!.includes("Hire one now"))!;
  memory.refuse("The proposal changed. Read it again.");
  await click(proposal(), "Keep");
  expect(proposal().querySelector('[role="alert"]')?.textContent).toBe("The proposal changed. Read it again.");
  memory.refuse(null);
  await click(proposal(), "Keep");
  expect(container.querySelector(".thread-main")?.textContent).toContain("Hire one now, the second in summer.");
  expect(container.querySelector(".thread-margin")?.textContent).not.toContain("Hire one now");
  await click([...container.querySelectorAll(".thread-margin-note")].find(note => note.textContent!.includes("March offsite"))!, "Dismiss");
  expect(container.querySelector(".thread-margin")?.textContent).not.toContain("March offsite");
  expect(container.querySelector(".thread-main")?.textContent).not.toContain("March offsite");
  expect(memory.acts.map(act => act.act)).toEqual(["keep", "keep", "dismiss"]);
  expect(memory.acts[1]).toEqual({ act: "keep", thread: mapping.slug, note: "2026-11-13T03:14:00Z" });
  await click(container, "‹ Work");
  expect(container.querySelector('[data-row="thread"]')!.textContent).toContain("1 note open");
}));

test("the response editor retains refusals, clears on success, and sends only addressed lines on Enter", async () => surface(async (container, render) => {
  const memory = studioClient();
  await render(<ThreadPage client={memory.client} project={mapping} assistantName="Mira" onChange={noop} />);
  await type(container, "My response");
  memory.refuse("This thread changed. Try again.");
  await click(container, "Add to the thread");
  expect(container.querySelector("textarea")!.value).toBe("My response");
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("This thread changed. Try again.");
  memory.refuse(null);
  await click(container, "Add to the thread");
  expect(container.querySelector("textarea")!.value).toBe("");
  expect(container.querySelector(".thread-main")?.textContent).toContain("My response");
  for (const mark of ["/", "Mira,"]) {
    const field = await type(container, `Keep this draft\n${mark} which one?\nAnd this`);
    field.focus(); field.setSelectionRange(19, 19);
    const enter = () => field.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true }));
    memory.refuse("Not now.");
    await act(async () => { enter(); });
    expect(field.value).toContain(`${mark} which one?`);
    memory.refuse(null);
    field.focus(); field.setSelectionRange(19, 19);
    await act(async () => { enter(); });
    expect(field.value).toBe("Keep this draft\nAnd this");
    expect(memory.acts.at(-1)).toEqual({ act: "respond", thread: mapping.slug, text: "which one?" });
  }
}));

test("the rich Markdown editor tints addressed lines, follows a loaded name and leaves ordinary Enter alone", async () => surface(async (container, render) => {
  const memory = studioClient();
  const page = (name?: string) => <ThreadPage client={memory.client} project={mapping} assistantName={name} onChange={noop} />;
  await render(page());
  const content = container.querySelector<HTMLElement>(".cm-content")!;
  const editor = EditorView.findFromDOM(content)!;
  const text = "A draft\nMira, which one?\n/ next?";
  await act(async () => { editor.dispatch({ changes: { from: 0, insert: text } }); });
  expect(container.querySelectorAll(".cm-thread-addressed")).toHaveLength(1);
  await render(page("Mira"));
  expect(container.querySelectorAll(".cm-thread-addressed")).toHaveLength(2);
  expect(container.querySelector(".cm-thread-addressed")?.getAttribute("data-hint")).toBe("Enter sends this line to Mira");
  const enter = () => content.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
  await act(async () => { editor.focus(); editor.dispatch({ selection: { anchor: 2 } }); enter(); });
  expect(memory.acts).toHaveLength(0);
  expect(editor.state.doc.lines).toBe(4);
  await act(async () => { editor.dispatch({ selection: { anchor: editor.state.doc.line(3).to } }); enter(); });
  expect(memory.acts.at(-1)).toEqual({ act: "respond", thread: mapping.slug, text: "which one?" });
  expect(editor.state.doc.toString()).toBe("A \ndraft\n/ next?");
  memory.refuse("Keep your question.");
  await act(async () => { editor.dispatch({ selection: { anchor: editor.state.doc.length } }); enter(); });
  expect(editor.state.doc.toString()).toBe("A \ndraft\n/ next?");
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Keep your question.");
}, true));

for (const rich of [false, true]) {
  test(`${rich ? "rich" : "plain"} addressed sends remove first, last and sole lines without leaving extra newlines`, async () => surface(async (container, render) => {
    const memory = studioClient();
    await render(<ThreadPage client={memory.client} project={mapping} assistantName="Mira" onChange={noop} />);
    for (const [text, at, remaining, sent] of [
      ["/ first\nDraft", 2, "Draft", "first"],
      ["Draft\nMira, last", 15, "Draft", "last"],
      ["/ only", 6, "", "only"],
    ] as const) {
      const content = container.querySelector<HTMLElement>(".cm-content");
      const editor = content ? EditorView.findFromDOM(content)! : null;
      const field = editor ? null : await type(container, text);
      await act(async () => {
        if (editor) {
          editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text }, selection: { anchor: at } });
          editor.focus();
        } else {
          field!.focus(); field!.setSelectionRange(at, at);
        }
        (content ?? field)!.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
      });
      expect(editor ? editor.state.doc.toString() : field!.value).toBe(remaining);
      expect(memory.acts.at(-1)).toEqual({ act: "respond", thread: mapping.slug, text: sent });
    }
    expect(memory.acts).toHaveLength(3);
  }, rich));

  test(`${rich ? "rich" : "plain"} addressed Enter consumes repeated and empty sends without changing the draft`, async () => surface(async (container, render) => {
    const { client, finish } = pendingClient();
    await render(<ThreadPage client={client} project={mapping} assistantName="Mira" onChange={noop} />);
    const content = container.querySelector<HTMLElement>(".cm-content");
    const editor = content ? EditorView.findFromDOM(content)! : null;
    const field = editor ? null : await type(container, "/ question");
    const enter = () => (content ?? field)!.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
    await act(async () => {
      if (editor) {
        editor.dispatch({ changes: { from: 0, insert: "/ question" }, selection: { anchor: 10 } });
        editor.focus();
      } else {
        field!.focus(); field!.setSelectionRange(10, 10);
      }
      enter(); enter();
    });
    expect(editor ? editor.state.doc.toString() : field!.value).toBe("/ question");
    await act(async () => { finish(Response.json({ ok: true })); });
    expect(editor ? editor.state.doc.toString() : field!.value).toBe("");
    if (!editor) await type(container, "/ ");
    await act(async () => {
      if (editor) editor.dispatch({ changes: { from: 0, insert: "/ " }, selection: { anchor: 2 } });
      else field!.setSelectionRange(2, 2);
      enter();
    });
    expect(editor ? editor.state.doc.toString() : field!.value).toBe("/ ");
  }, rich));
}

test("a failed Studio read removes the editor", async () => surface(async (container, render) => {
  const memory = studioClient(); memory.breakStudio();
  await render(<ThreadPage client={memory.client} project={mapping} assistantName="Mira" onChange={noop} />);
  expect(container.textContent).toContain("Studio cannot be read.");
  expect(container.querySelector("textarea")).toBeNull();
}));

test("a successful response cannot erase text typed while Cortex writes", async () => surface(async (container, render) => {
  const { client, finish } = pendingClient();
  await render(<ThreadPage client={client} project={mapping} assistantName="Mira" onChange={noop} />);
  await type(container, "Sent draft");
  await click(container, "Add to the thread");
  expect(container.querySelector<HTMLButtonElement>(".thread-main button")!.disabled).toBe(true);
  await type(container, "Sent draft\nMore while waiting");
  await act(async () => { finish(Response.json({ ok: true })); });
  expect(container.querySelector("textarea")!.value).toBe("Sent draft\nMore while waiting");
}));

test("an addressed line follows edits before it during a pending response and removes only that line", async () => surface(async (container, render) => {
  const { client, finish } = pendingClient();
  await render(<ThreadPage client={client} project={mapping} assistantName="Mira" onChange={noop} />);
  const content = container.querySelector<HTMLElement>(".cm-content")!;
  const editor = EditorView.findFromDOM(content)!;
  await act(async () => {
    editor.dispatch({ changes: { from: 0, insert: "Before\n/ which one?\nAfter" }, selection: { anchor: 18 } });
    editor.focus();
    content.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true }));
  });
  await act(async () => { editor.dispatch({ changes: { from: 0, insert: "New words\n" } }); });
  await act(async () => { finish(Response.json({ ok: true })); });
  expect(editor.state.doc.toString()).toBe("New words\nBefore\nAfter");
  await act(async () => { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length } }); });
  expect(container.querySelector(".cm-placeholder")?.textContent).toContain("sends it to Mira");
}, true));

test("new text at either edge of an addressed line survives a successful pending response", async () => surface(async (container, render) => {
  const { client, finish } = pendingClient();
  await render(<ThreadPage client={client} project={mapping} assistantName="Mira" onChange={noop} />);
  const content = container.querySelector<HTMLElement>(".cm-content")!;
  const editor = EditorView.findFromDOM(content)!;
  for (const edge of ["start", "end"] as const) {
    await act(async () => {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: "/ question" }, selection: { anchor: 10 } });
      editor.focus();
      content.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true }));
    });
    await act(async () => { editor.dispatch({ changes: { from: edge === "start" ? 0 : editor.state.doc.length, insert: "xyz" } }); });
    await act(async () => { finish(Response.json({ ok: true })); });
    expect(editor.state.doc.toString()).toBe(edge === "start" ? "xyz/ question" : "/ questionxyz");
  }
}, true));

test("a failed refresh after responding hides the editor and preserves newer text for recovery", async () => surface(async (container, render) => {
  const { client, finish, setReadable } = pendingClient();
  const page = (active = true) => <ThreadPage client={client} project={mapping} active={active} assistantName="Mira" onChange={noop} />;
  await render(page());
  await type(container, "Sent draft");
  await click(container, "Add to the thread");
  await type(container, "Sent draft\nMore while waiting");
  setReadable(false);
  await act(async () => { finish(Response.json({ ok: true })); });
  expect(container.textContent).toContain("Studio cannot be read.");
  expect(container.querySelector("textarea")).toBeNull();
  setReadable(true);
  await render(page(false));
  await render(page());
  expect(container.querySelector("textarea")!.value).toBe("Sent draft\nMore while waiting");
}));

test("an old successful response cannot clear a draft written after Studio recovery", async () => surface(async (container, render) => {
  const { client, finish, setReadable } = pendingClient();
  const page = (active = true) => <ThreadPage client={client} project={mapping} active={active} assistantName="Mira" onChange={noop} />;
  await render(page());
  await type(container, "Sent draft");
  await click(container, "Add to the thread");
  setReadable(false);
  await render(page(false)); await render(page());
  expect(container.textContent).toContain("Studio cannot be read.");
  setReadable(true);
  await render(page(false)); await render(page());
  await type(container, "A newer draft after recovery");
  await act(async () => { finish(Response.json({ ok: true })); });
  expect(container.querySelector("textarea")!.value).toBe("A newer draft after recovery");
}));

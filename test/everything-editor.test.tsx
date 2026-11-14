import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { EditorView } from "@codemirror/view";
import { NoteEditor, type LineDecoration } from "../src/ui/everything/editor";

// CodeMirror needs the DOM globals of a browser window, including the observers happy-dom provides.
const RICH = ["window", "document", "MutationObserver", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle", "DOMRect", "Range"] as const;
const PLAIN = ["window", "document"] as const;

interface Surface {
  container: HTMLElement;
  changes: string[];
  leaves: { text: string; at: number }[];
  render: (value: string, clean?: boolean, decoration?: LineDecoration) => Promise<void>;
  close: () => Promise<void>;
}

let open: (() => Promise<void>) | null = null;

afterEach(async () => {
  await open?.();
  open = null;
});

async function surface(globals: readonly string[], value: string, place: number | null, decoration?: LineDecoration): Promise<Surface> {
  const dom = new Window();
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const name of globals) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    const value = name === "window" ? dom : name === "document" ? dom.document : (dom as unknown as Record<string, unknown>)[name];
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const actFlag = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, writable: true, value: true });
  const container = dom.document.createElement("div") as unknown as HTMLElement;
  dom.document.body.append(container as unknown as never);
  const root = createRoot(container);
  const changes: string[] = [];
  const leaves: { text: string; at: number }[] = [];
  const render = async (text: string, clean = true, lineDecoration = decoration) => {
    await act(async () => {
      root.render(<NoteEditor value={text} label="Page of Write the script" hint="Write on this page…" place={place} clean={clean} lineDecoration={lineDecoration}
        onChange={next => changes.push(next)} onLeave={(next, at) => leaves.push({ text: next, at })} />);
    });
  };
  await render(value);
  const close = async () => {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    if (actFlag) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", actFlag);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  };
  open = close;
  return { container, changes, leaves, render, close };
}

async function rich(value: string, place: number | null = null) {
  const opened = await surface(RICH, value, place);
  const content = opened.container.querySelector(".cm-content") as HTMLElement;
  const editor = EditorView.findFromDOM(content);
  expect(editor).not.toBeNull();
  return { ...opened, content, editor: editor! };
}

const lineText = (container: HTMLElement) => [...container.querySelectorAll(".cm-line")].map(line => line.textContent).join("\n");

describe("the page's editor", () => {
  test("shows Markdown formatted, with the marks of the cursor's lines", async () => {
    const page = await rich("## Plan\n\nA **bold** line with *care*, `code` and a [link](https://threva.example)\n\n> quoted\n\n```\nlet x = 1\n```");
    // No focus: no line is the cursor's, so every mark is hidden.
    expect(page.editor.hasFocus).toBe(false);
    expect(lineText(page.container)).not.toContain("##");
    expect(lineText(page.container)).not.toContain("**");
    await act(async () => page.content.focus());
    await act(async () => page.editor.dispatch({ selection: { anchor: page.editor.state.doc.line(3).from + 2 } }));
    const lines = lineText(page.container).split("\n");
    expect(lines[0]).not.toContain("##");
    expect(lines[2]).toContain("**bold**");
    expect(lines[2]).toContain("*care*");
    expect(lines[2]).toContain("`code`");
    expect(lines[2]).toContain("[link](https://threva.example)");
    expect(lines[4]).not.toContain(">");
    // Marks come back on every line a selection reaches.
    await act(async () => page.editor.dispatch({ selection: { anchor: 0, head: page.editor.state.doc.length } }));
    expect(lineText(page.container).split("\n")[0]).toContain("##");
    expect(lineText(page.container).split("\n")[4]).toContain(">");
    expect(page.container.querySelector(".cm-note-h2")).not.toBeNull();
    expect(page.container.querySelector(".cm-note-quote")).not.toBeNull();
    expect(page.container.querySelector(".cm-note-code")).not.toBeNull();
  });

  test("hands the Markdown text to the page and the cursor place back on leaving", async () => {
    const page = await rich("## Plan");
    await act(async () => page.content.focus());
    await act(async () => page.editor.dispatch({ changes: { from: page.editor.state.doc.length, insert: "\n\nA **bold** line" } }));
    expect(page.changes.at(-1)).toBe("## Plan\n\nA **bold** line");
    await act(async () => page.editor.dispatch({ selection: { anchor: 7 } }));
    await act(async () => page.content.blur());
    expect(page.leaves.at(-1)).toEqual({ text: "## Plan\n\nA **bold** line", at: 7 });
  });

  test("an empty page shows the placeholder", async () => {
    const page = await rich("");
    expect(page.container.querySelector(".cm-placeholder")?.textContent).toBe("Write on this page…");
    expect(page.container.querySelector('[aria-label="Page of Write the script"]')).not.toBeNull();
  });

  test("returning to a page stands the cursor where it was", async () => {
    const page = await rich("## Plan\n\nA bold line", 9);
    expect(page.editor.state.selection.main.head).toBe(9);
    expect(page.editor.hasFocus).toBe(true);
  });

  test("takes plain Markdown when the rich editor cannot start", async () => {
    const page = await surface(PLAIN, "## Plan", null);
    const field = page.container.querySelector("textarea")!;
    expect(field).not.toBeNull();
    expect(field.getAttribute("placeholder")).toBe("Write on this page…");
    expect(field.value).toBe("## Plan");
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(field, "## Plan\n\nmore");
      field.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    expect(page.changes.at(-1)).toBe("## Plan\n\nmore");
  });

  test("a clean plain page takes a reloaded note, and leaving sends the reloaded text", async () => {
    const page = await surface(PLAIN, "## Plan", null);
    const field = page.container.querySelector("textarea")!;
    await page.render("## Plan from elsewhere");
    expect(field.value).toBe("## Plan from elsewhere");
    await act(async () => { field.focus(); field.blur(); });
    expect(page.leaves.at(-1)?.text).toBe("## Plan from elsewhere");
  });

  test("a plain page with a draft in hand keeps what the user typed", async () => {
    const page = await surface(PLAIN, "## Plan", null);
    const field = page.container.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(field, "## Plan\n\nmy draft");
      field.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await page.render("## Plan from elsewhere", false);
    expect(field.value).toBe("## Plan\n\nmy draft");
  });
});

test("line decoration skips unrelated transactions and refreshes when its configuration changes", async () => {
  let scans = 0;
  const decoration: LineDecoration = { matches: text => { scans++; return text.startsWith("/"); }, className: "marked-line", plainClassName: "marked-field", hint: "Old hint" };
  const page = await surface(RICH, "/ question", null, decoration);
  const editor = EditorView.findFromDOM(page.container.querySelector<HTMLElement>(".cm-content")!)!;
  expect(page.container.querySelector(".marked-line")?.getAttribute("data-hint")).toBe("Old hint");
  const before = scans;
  await act(async () => { editor.dispatch({}); });
  expect(scans).toBe(before);
  await page.render("/ question", true, { ...decoration, hint: "New hint" });
  expect(scans).toBeGreaterThan(before);
  expect(page.container.querySelector(".marked-line")?.getAttribute("data-hint")).toBe("New hint");
});

test("hides the marks of headings one to three, strike-through, code and links", async () => {
  const page = await rich("# Title\n\n### Small\n\n~~gone~~ and **bold** and *italic*\n\n`code` and [link](https://threva.example)\n\n> quoted\n\n```\nconst x = 1\n```");
  const text = lineText(page.container);
  expect(text).toContain("Title");
  expect(text).toContain("Small");
  expect(text).toContain("gone");
  expect(text).not.toContain("#");
  expect(text).not.toContain("~~");
  expect(text).not.toContain("**");
  expect(text).not.toContain("`");
  expect(text).not.toContain("](");
  expect(text).not.toContain("> quoted");
  expect(text).toContain("const x = 1");
  expect(page.container.querySelector(".cm-note-h1")).not.toBeNull();
  expect(page.container.querySelector(".cm-note-h3")).not.toBeNull();
  expect(page.container.querySelector(".cm-note-quote")).not.toBeNull();
  expect(page.container.querySelector(".cm-note-code")).not.toBeNull();
});

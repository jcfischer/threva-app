import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DayView } from "../src/ui/app";
import { createClient } from "../src/ui/api/client";
import { EMPTY_SESSION, pin } from "../src/ui/queue/order";
import { NOW, item, sweep, view } from "./fixtures/desk";

describe("front-card keyboard events", () => {
  let dom: Window;
  let root: Root;
  let originals: Map<string, PropertyDescriptor | undefined>;
  let writes: unknown[];

  beforeEach(() => {
    dom = new Window();
    const globals = { window: dom, document: dom.document, HTMLElement: dom.HTMLElement, Element: dom.Element, IS_REACT_ACT_ENVIRONMENT: true };
    originals = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    writes = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });

  async function render(front: "task" | "sweep") {
    const desk = view({
      items: [item({ key: "mail", kind: "mail", title: "Workshop dates" })],
      myDay: { items: [{ task: { id: "task", title: "Write the report" }, areaTitle: "Work" }] },
      mailSweeps: [sweep()],
    });
    const client = createClient(async (_url, init) => {
      writes.push(JSON.parse(init!.body as string));
      return new Response("{}");
    });
    await act(async () => {
      root.render(<DayView client={client} state={{ view: desk, studio: null, error: null, refresh: () => {} }} session={pin(EMPTY_SESSION, front === "task" ? "d:task" : "s:news")} setSession={() => {}} now={NOW} />);
    });
  }

  async function press(target: Element, key = "Enter", options: KeyboardEventInit = {}) {
    const event = new window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, ...options });
    await act(async () => { target.dispatchEvent(event); });
    return event;
  }

  for (const front of ["task", "sweep"] as const) {
    test(`${front}: Enter on card controls, Then titles, task chips and Inbox is left to the control`, async () => {
      await render(front);
      for (const button of document.querySelectorAll("button")) {
        const child = document.createElement("span");
        button.append(child);
        expect((await press(child)).defaultPrevented).toBe(false);
        expect(writes).toEqual([]);
      }
      for (const html of ['<a href="#target"><span>Link</span></a>', '<div role="button" tabindex="0"><span>Control</span></div>', '<button><svg><path /></svg></button>']) {
        const host = document.createElement("div");
        host.innerHTML = html;
        document.body.append(host);
        expect((await press(host.querySelector("span, path")!)).defaultPrevented).toBe(false);
        expect(writes).toEqual([]);
      }
    });

    test(`${front}: Enter on the page runs the front act once`, async () => {
      await render(front);
      expect((await press(document.body)).defaultPrevented).toBe(true);
      expect(writes).toEqual([front === "task" ? { op: "done", id: "task" } : { action: "sweep", sweep: "news", keys: [], target: "archive" }]);
    });
  }

  test("text fields and modified or repeated keys do not run the card act", async () => {
    await render("task");
    for (const html of ['<input />', '<textarea></textarea>', '<select></select>', '<div role="textbox"><span>Text</span></div>', '<div contenteditable="true"><span>Text</span></div>']) {
      const host = document.createElement("div");
      host.innerHTML = html;
      document.body.append(host);
      const target = host.querySelector("span") ?? host.firstElementChild!;
      for (const key of ["Enter", "Escape"]) expect((await press(target, key)).defaultPrevented).toBe(false);
    }
    for (const options of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
      expect((await press(document.body, "Enter", options)).defaultPrevented).toBe(false);
    }
    expect(writes).toEqual([]);
  });

  test("Escape remains a card shortcut while a button has focus", async () => {
    await render("task");
    const button = document.querySelector(".cards > .row button")!;
    expect((await press(button, "Escape")).defaultPrevented).toBe(true);
    expect(writes).toEqual([]);
  });
});

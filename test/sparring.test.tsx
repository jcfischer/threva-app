import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient, type Fetch } from "../src/ui/api/client";
import type { StudioThread } from "../src/ui/api/types";
import { QueueContext } from "../src/ui/cards/act";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { STUDIO_ACT_PATH } from "../src/ui/studio/act";
import { sparAvailability, sparRequests, Sparring } from "../src/ui/studio/sparring";
import { budgetThread, openThinking } from "./fixtures/studio";

const MODES = ["Think now", "Grill me", "Argue the other side", "Red team", "First principles"];

const noFetch: Fetch = async () => new Response("{}");

const render = (thread: StudioThread = budgetThread, personas: readonly string[] = [], locale: "en" | "de" = "en") =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <QueueContext.Provider value={{ client: createClient(noFetch), refresh: () => {} }}>
        <Sparring thread={thread} personas={personas} />
      </QueueContext.Provider>
    </I18nProvider>,
  );

const buttons = (html: string) => html.match(/<button\b[^>]*>.*?<\/button>/g) ?? [];
/** Static markup escapes apostrophes, which Cortex's reasons carry. */
const shown = (html: string) => html.replaceAll("&#x27;", "'");
const disabledButtons = (html: string) => buttons(html).filter((button) => button.includes("disabled"));

const withThinking = (thinking: StudioThread["thinking"]): StudioThread => ({ ...budgetThread, thinking });

const label = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll("button")).find((button) => button.textContent === text);

describe("the sparring rail", () => {
  test("offers the five modes and one question per name in studio.personas", () => {
    const html = render(budgetThread, ["Grace Hopper", "A skeptic"]);
    for (const label of MODES) expect(html).toContain(`>${label}<`);
    expect(html).toContain("What would Grace Hopper say?");
    expect(html).toContain("What would A skeptic say?");
    expect(disabledButtons(html)).toEqual([]);
    expect(render(budgetThread)).not.toContain("What would");
  });

  test("the modes and personas Cortex lists become their act modes, in order", () => {
    expect(sparRequests(["Grace Hopper"]).map((r) => r.mode)).toEqual([
      "think",
      "grill",
      "other-side",
      "red-team",
      "first-principles",
      "persona:Grace Hopper",
    ]);
    expect(sparRequests()).toHaveLength(5);
  });

  test("is German too", () => {
    const html = render(budgetThread, ["Grace Hopper"], "de");
    for (const label of ["Durchdenken", "Grill mich", "Gegenseite", "Red Team", "Erste Prinzipien", "Was würde Grace Hopper sagen?"]) expect(html).toContain(label);
  });

  test("disables every button with Cortex's reason when Ranger is not configured", () => {
    const reason = "Thinking needs Ranger configured on this stack.";
    const html = render(withThinking({ kind: "unavailable", reason }));
    expect(shown(html)).toContain(reason);
    expect(disabledButtons(html)).toHaveLength(5);
    expect(html).toContain(`title="${reason}"`);
  });

  test("disables every button with Cortex's reason when the budget is spent or turned off", () => {
    const spent = "Today's cloud thinking budget is spent. Queued requests wait until tomorrow (UTC).";
    const spentHtml = render(withThinking({ kind: "ready", budget: "spent", reason: spent, runs: [] }));
    expect(shown(spentHtml)).toContain(spent);
    expect(disabledButtons(spentHtml)).toHaveLength(5);

    const off = "Cloud thinking is turned off: its daily run limit in Ranger is 0.";
    const offHtml = render(withThinking({ kind: "ready", budget: "off", reason: off, runs: [] }));
    expect(shown(offHtml)).toContain(off);
    expect(disabledButtons(offHtml)).toHaveLength(5);
  });

  test("sends while the budget is open and waits for the queue when Cortex has not said", () => {
    expect(sparAvailability(openThinking)).toEqual({ ready: true });
    expect(sparAvailability(undefined)).toEqual({ ready: false, reason: null });
    expect(render(withThinking(undefined))).toContain("The thinking queue has not loaded yet.");
    expect(disabledButtons(render(withThinking(undefined)))).toHaveLength(5);
  });

  test("marks the modes Cortex still holds a run for", () => {
    const run = { id: "run-1", mode: "red-team", status: "pending" as const, reason: "Queued. Ivy is waiting to start." };
    const html = render(withThinking({ kind: "ready", budget: "open", reason: null, runs: [run] }));
    expect(html).toContain("Queued: Red team");
    expect(html).toContain(run.reason);
    expect(disabledButtons(html)).toHaveLength(1);
  });

  test("a failed run shows its reason and leaves its button open, so the mode can be asked again", () => {
    const run = { id: "run-2", mode: "grill", status: "failed" as const, reason: "Ranger stopped: the model is unavailable." };
    const html = render(withThinking({ kind: "ready", budget: "open", reason: null, runs: [run] }));
    expect(html).toContain("Thinking failed");
    expect(html).toContain(run.reason);
    expect(html).not.toContain("Queued: Grill me");
    expect(disabledButtons(html)).toEqual([]);
  });

  test("a closed thread has no sparring", () => {
    expect(render({ ...budgetThread, state: "closed" })).toBe("");
  });
});

async function withDom(
  run: (
    click: (label: string) => Promise<void>,
    container: HTMLElement,
    show: (thread: StudioThread) => Promise<void>,
  ) => Promise<void>,
  fetchImpl: Fetch,
) {
  const dom = new Window();
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const click = async (label: string) => {
    const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label);
    if (!button) throw new Error(`no button labelled ${label}`);
    await act(async () => {
      button.click();
    });
  };
  const client = createClient(fetchImpl);
  const show = async (thread: StudioThread) => {
    await act(async () => {
      root.render(
        <I18nProvider value={createI18n("en")}>
          <QueueContext.Provider value={{ client, refresh: () => {} }}>
            <Sparring thread={thread} personas={["Grace Hopper"]} />
          </QueueContext.Provider>
        </I18nProvider>,
      );
    });
  };
  try {
    await show(budgetThread);
    await run(click, container, show);
  } finally {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

describe("a click on the rail", () => {
  test("sends the spar act and marks the button queued once Cortex answers", async () => {
    const posts: { path: string; body: Record<string, unknown> }[] = [];
    const fetchImpl: Fetch = async (path, init) => {
      posts.push({ path, body: JSON.parse(String(init?.body)) });
      return Response.json({ ok: true, message: "Asked Ivy: grill. The note will appear here when it lands." });
    };
    await withDom(async (click, container) => {
      await click("Grill me");
      const button = label(container, "Queued: Grill me");
      expect(button).toBeDefined();
      expect(button?.hasAttribute("disabled")).toBe(true);
      expect(container.textContent).toContain("Asked Ivy: grill. The note will appear here when it lands.");
    }, fetchImpl);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.path).toBe(STUDIO_ACT_PATH);
    expect(posts[0]?.body).toMatchObject({ act: "spar", thread: "budget-next-year", mode: "grill" });
    expect(String(posts[0]?.body.requestId)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  test("a persona button sends its persona mode", async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl: Fetch = async (_path, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ ok: true, message: "Asked Ivy: persona:Grace Hopper." });
    };
    await withDom(async (click, container) => {
      await click("What would Grace Hopper say?");
      expect(container.textContent).toContain("Asked Ivy: persona:Grace Hopper.");
    }, fetchImpl);
    expect(body).toMatchObject({ act: "spar", thread: "budget-next-year", mode: "persona:Grace Hopper" });
  });

  test("a run that failed before a refresh settles the mark, so the mode can be asked again", async () => {
    const fetchImpl: Fetch = async () => Response.json({ ok: true, message: "Asked Ivy: grill." });
    const failed: StudioThread = {
      ...budgetThread,
      thinking: {
        kind: "ready",
        budget: "open",
        reason: null,
        runs: [{ id: "run-2", mode: "grill", status: "failed", reason: "Ranger stopped: the model is unavailable." }],
      },
    };
    await withDom(async (click, container, show) => {
      await click("Grill me");
      expect(label(container, "Queued: Grill me")?.hasAttribute("disabled")).toBe(true);

      await show(failed);
      const button = label(container, "Grill me");
      expect(button?.hasAttribute("disabled")).toBe(false);
      expect(label(container, "Queued: Grill me")).toBeUndefined();
      expect(container.textContent).toContain("Ranger stopped: the model is unavailable.");
    }, fetchImpl);
  });

  test("a run that finished before a refresh settles the mark, so the mode can be asked again", async () => {
    const fetchImpl: Fetch = async () => Response.json({ ok: true, message: "Asked Ivy: red-team." });
    await withDom(async (click, container, show) => {
      await click("Red team");
      expect(label(container, "Queued: Red team")?.hasAttribute("disabled")).toBe(true);

      await show({ ...budgetThread, thinking: { ...openThinking, runs: [] } });
      const button = label(container, "Red team");
      expect(button?.hasAttribute("disabled")).toBe(false);
      expect(container.textContent).not.toContain("Asked Ivy: red-team.");
    }, fetchImpl);
  });

  test("keeps the mark while the same snapshot shows no run yet", async () => {
    const fetchImpl: Fetch = async () => Response.json({ ok: true, message: "Asked Ivy: think." });
    await withDom(async (click, container) => {
      await click("Think now");
      expect(label(container, "Queued: Think now")?.hasAttribute("disabled")).toBe(true);
    }, fetchImpl);
  });

  test("shows Cortex's message when the act answers an error, and leaves the buttons alone", async () => {
    const fetchImpl: Fetch = async () => Response.json({ ok: false, error: "Ranger is configured for another Studio directory." }, { status: 503 });
    await withDom(async (click, container) => {
      await click("Red team");
      expect(container.querySelector('[role="alert"]')?.textContent).toBe("Ranger is configured for another Studio directory.");
      const button = label(container, "Red team");
      expect(button?.hasAttribute("disabled")).toBe(false);
    }, fetchImpl);
  });
});

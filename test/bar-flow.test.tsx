import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { filesAtOnce, type Proposal } from "@desk/capture";
import { createClient, type DeskClient, type Fetch } from "@desk/client";
import { createMemoryClient, type MemoryClient } from "@desk/memory-client";
import { Bar } from "../src/ui/bar/bar";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { mountDom, type MountedDom } from "./fixtures/dom";

const capture: Proposal = { kind: "capture", label: "Capture", fields: { text: "Empty places" }, automatic: true };

let dom: MountedDom;
let client: MemoryClient;
let refreshed: number;

beforeEach(() => {
  dom = mountDom();
  client = createMemoryClient();
  refreshed = 0;
});
afterEach(async () => {
  await dom.cleanup();
});

async function mountWith(desk: DeskClient) {
  await act(async () => {
    dom.root.render(
      <I18nProvider value={createI18n("en")}>
        <Bar client={desk} onChange={() => { refreshed += 1; }} />
      </I18nProvider>,
    );
  });
}

const mount = () => mountWith(client);

const field = () => dom.container.querySelector("input")!;

interface Props {
  onChange: (e: unknown) => void;
  onKeyDown: (e: unknown) => void;
}
const props = (): Props => {
  const input = field();
  const key = Object.keys(input).find((k) => k.startsWith("__reactProps$"))!;
  return (input as unknown as Record<string, Props>)[key];
};
const type = (text: string) =>
  act(async () => {
    props().onChange({ target: { value: text }, currentTarget: { value: text } });
  });
const enter = async () => {
  await act(async () => {
    props().onKeyDown({ key: "Enter", preventDefault() {} });
  });
};
const names = () => client.calls.map((call) => call.name);

function wire(answer: (index: number) => Response | object) {
  const sent: { path: string; body: Record<string, unknown> }[] = [];
  const fetchImpl: Fetch = async (path, init) => {
    const text = typeof init?.body === "string" ? init.body : "{}";
    sent.push({ path, body: JSON.parse(text) as Record<string, unknown> });
    const reply = answer(sent.length - 1);
    return reply instanceof Response ? reply : Response.json(reply);
  };
  return { sent, client: createClient(fetchImpl) };
}

const PLAIN = /^[0-9a-f]{32}$/;
const DASHED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const button = (label: string) => Array.from(dom.container.querySelectorAll("button")).find((b) => b.textContent === label);
const click = async (label: string) => {
  await act(async () => { button(label)!.click(); });
};

describe("filing a note at once", () => {
  test("only a capture Cortex marked automatic is filed without the card", () => {
    expect(filesAtOnce(capture)).toBe(true);
    expect(filesAtOnce({ ...capture, automatic: false })).toBe(false);
    expect(filesAtOnce({ ...capture, kind: "task" })).toBe(false);
    expect(filesAtOnce({ ...capture, problem: "The Studio is turned off." })).toBe(false);
  });

  test("an automatic capture goes straight to the Desk and leaves Undo", async () => {
    client.seed("capture.ask", { ok: true, data: { proposal: capture } });
    client.seed("capture.create", { ok: true, data: { id: "c1", message: "Filed." } });
    client.seed("capture.undo", { ok: true, data: {} });
    await mount();
    await type("  Empty places  ");
    await enter();
    expect(names()).toEqual(["capture.ask", "capture.create"]);
    expect(client.calls[0]?.args).toEqual(["Empty places"]);
    const created = client.calls[1];
    expect(created.args[0]).toBe("capture");
    expect(created.args[1]).toEqual({ text: "Empty places" });
    expect(created.args[2]).toEqual(expect.any(String));
    expect(dom.container.textContent).toContain("Kept.");
    expect(button("Undo")).toBeDefined();
    expect(refreshed).toBe(1);
    await click("Undo");
    expect(names()).toEqual(["capture.ask", "capture.create", "capture.undo"]);
    expect(client.calls[2]?.args).toEqual([{ id: "c1", requestId: created.args[2] }]);
    expect(refreshed).toBe(2);
  });

  test("a proposal Cortex did not mark automatic keeps its card", async () => {
    const plain: Proposal = { kind: "capture", label: "Capture", fields: { text: "Empty places" } };
    client.seed("capture.ask", { ok: true, data: { proposal: plain } });
    client.seed("capture.create", { ok: true, data: { id: "c1" } });
    await mount();
    await type("Empty places");
    await enter();
    expect(names()).toEqual(["capture.ask"]);
    expect(dom.container.textContent).toContain("Keep");
    await click("Keep");
    expect(names()).toEqual(["capture.ask", "capture.create"]);
    expect(refreshed).toBe(1);
  });

  test("a failing create reports Cortex's message and leaves the text", async () => {
    client.seed("capture.ask", { ok: true, data: { proposal: capture } });
    client.seed("capture.create", { ok: false, message: "The Studio is turned off.", status: 409 });
    await mount();
    await type("Empty places");
    await enter();
    expect(dom.container.querySelector('[role="alert"]')?.textContent).toBe("The Studio is turned off.");
    expect(field().value).toBe("Empty places");
    expect(refreshed).toBe(0);
  });

  test("a create that failed with no response is retried with the same request id", async () => {
    let attempts = 0;
    client.seed("capture.ask", { ok: true, data: { proposal: capture } });
    client.seed("capture.create", () => {
      attempts += 1;
      return attempts === 1 ? { ok: false, message: null, status: 0 } : { ok: true, data: { id: "c1" } };
    });
    await mount();
    await type("Empty places");
    await enter();
    expect(dom.container.querySelector('[role="alert"]')?.textContent).toBe("Cortex is not reachable. Threva keeps what it last saw and tries again.");
    expect(field().value).toBe("Empty places");
    await enter();
    const creates = client.calls.filter((call) => call.name === "capture.create");
    expect(creates).toHaveLength(2);
    expect(creates[1]?.args[2]).toBe(creates[0]?.args[2]);
    expect(refreshed).toBe(1);
  });

  test("a refused ask stops before the card", async () => {
    client.seed("capture.ask", { ok: false, message: "No conversation model is configured. Nothing was sent.", status: 503 });
    await mount();
    await type("Empty places");
    await enter();
    expect(names()).toEqual(["capture.ask"]);
    expect(dom.container.querySelector('[role="alert"]')?.textContent).toBe("No conversation model is configured. Nothing was sent.");
  });

  test("an empty bar sends nothing", async () => {
    await mount();
    await enter();
    await type("   ");
    await enter();
    expect(client.calls).toEqual([]);
  });
});

describe("starting the conversation from the ask row", () => {
  test("asks the named conversations call with the text and reports that it started", async () => {
    client.seed("conversations.ask", { ok: true, data: {} });
    await mount();
    await type(" is the workshop done? ");
    await enter();
    expect(names()).toEqual(["conversations.ask"]);
    expect(client.calls[0]?.args[0]).toBe("is the workshop done?");
    expect(dom.container.textContent).toContain("The conversation has started. The assistant answers in the Studio.");
  });

  test("a refusal shows Cortex's message", async () => {
    client.seed("conversations.ask", { ok: false, message: "No conversation model is configured. Nothing was sent.", status: 503 });
    await mount();
    await type("is the workshop done?");
    await enter();
    expect(dom.container.querySelector('[role="alert"]')?.textContent).toBe("No conversation model is configured. Nothing was sent.");
  });
});

describe("the ids the bar shows reach Cortex through the real client", () => {
  test("the undo request id is the one the create sent", async () => {
    const { sent, client: http } = wire((index) =>
      index === 0 ? { proposal: capture } : index === 1 ? { id: "c1", message: "Filed." } : {},
    );
    await mountWith(http);
    await type("Empty places");
    await enter();
    await click("Undo");
    const created = sent[1]?.body;
    expect(created?.requestId).toMatch(PLAIN);
    expect(sent[2]?.body).toEqual({ id: "c1", requestId: created?.requestId });
  });

  test("the ask sends a start id with the text", async () => {
    const { sent, client: http } = wire(() => ({}));
    await mountWith(http);
    await type(" is the workshop done? ");
    await enter();
    expect(sent[0]?.body.text).toBe("is the workshop done?");
    expect(sent[0]?.body.startId).toMatch(DASHED);
  });
});

describe("searching the Desk from the bar", () => {
  test("opens the full note from the Desk by ID", async () => {
    client.seed("search", { ok: true, data: { status: "ok", unavailableKinds: [], next: null, hits: [
      { kind: "desk-note", id: "41", title: "Workshop", snippet: "Short preview", at: null },
    ] } });
    client.seed("desk", { ok: true, data: { items: [], notes: [{ id: 41, text: "Full workshop note", createdAt: 0 }] } });
    await mount();
    await type("workshop");
    await click("Search for workshop");
    await click("Workshop");
    expect(client.calls).toEqual([{ name: "search", args: ["workshop"] }, { name: "desk", args: [] }]);
    expect(dom.container.textContent).toContain("Full workshop note");
  });

  test("retains the words when nothing matches", async () => {
    client.seed("search", { ok: true, data: { status: "empty", unavailableKinds: [], next: null, hits: [] } });
    await mount();
    await type("missing");
    await click("Search for missing");
    expect(dom.container.textContent).toContain("Nothing matched.");
    expect(field().value).toBe("missing");
  });

  test("a failed search leaves note capture available", async () => {
    client.seed("capture.ask", { ok: true, data: { proposal: capture } });
    client.seed("capture.create", { ok: true, data: { id: "c1" } });
    await mount();
    await type("offline");
    await click("Search for offline");
    expect(dom.container.querySelector('[role="alert"]')?.textContent).toBe("Search is unavailable. Try again.");
    expect(field().value).toBe("offline");
    await enter();
    expect(names()).toEqual(["search", "capture.ask", "capture.create"]);
  });
});

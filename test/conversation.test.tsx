import { afterEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { linkedConversation, lines, readExchange, type Exchange, type StudioSession } from "../src/ui/api/conversations";
import { createMemoryClient, type MemoryClient } from "../src/ui/api/memory-client";
import { QueueContext } from "../src/ui/cards/act";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { DiscussNote, ExchangeView, SessionView, TalkItThrough } from "../src/ui/studio/conversation";
import { StudioOpen } from "../src/ui/studio/card";
import { mountDom, type MountedDom } from "./fixtures/dom";
import { budgetThread } from "./fixtures/studio";

const meta = { id: "c1", title: "What goes into next year's budget?", activity: { lastAt: "2026-11-14T08:00:00Z", status: "idle" as const } };
const entries = [
  { id: "1", kind: "cortex.input", role: "user" as const, text: "Which hire first?" },
  { id: "2", kind: "message", role: "tool" as const, text: "tool noise" },
  { id: "3", kind: "message", role: "assistant" as const, text: "The designer first.", model: "pi/claude-sonnet" },
];
const exchange: Exchange = { conversation: meta, using: "pi/claude-sonnet", entries, working: false };

const wrap = (node: React.ReactNode) => renderToStaticMarkup(<I18nProvider value={createI18n("en")}>{node}</I18nProvider>);

describe("the conversation client", () => {
  test("a thread with a conversation offers the newest one", async () => {
    const client = createMemoryClient();
    client.seed("conversations.source", { ok: true, data: { conversations: [meta, { ...meta, id: "old" }] } });
    expect(await linkedConversation(client, "budget-next-year")).toBe("c1");
    expect(client.calls).toEqual([{ name: "conversations.source", args: ["budget-next-year"] }]);
  });

  test("a thread without one, or a failed lookup, offers none", async () => {
    const empty = createMemoryClient();
    empty.seed("conversations.source", { ok: true, data: { conversations: [] } });
    expect(await linkedConversation(empty, "t")).toBeNull();
    const failed = createMemoryClient();
    failed.seed("conversations.source", { ok: false, message: "no", status: 503 });
    expect(await linkedConversation(failed, "t")).toBeNull();
  });

  test("reading joins the detail and the entries, and is working while an input is queued", async () => {
    const client = createMemoryClient();
    client.seed("conversations.detail", { ok: true, data: { conversation: meta, models: { using: "pi/claude-sonnet" }, pending: [{ inputId: "in-1", status: "queued" }] } });
    client.seed("conversations.entries", { ok: true, data: { entries } });
    const r = await readExchange(client, "c1");
    expect(r.ok && r.data.working).toBe(true);
    expect(r.ok && r.data.entries.length).toBe(3);
    expect(client.calls.map((call) => call.name).sort()).toEqual(["conversations.detail", "conversations.entries"]);
  });

  test("a failed detail read comes back as Cortex's refusal", async () => {
    const client = createMemoryClient();
    client.seed("conversations.detail", { ok: false, message: "Unknown conversation.", status: 404 });
    client.seed("conversations.entries", { ok: true, data: { entries } });
    expect(await readExchange(client, "c1")).toEqual({ ok: false, message: "Unknown conversation.", status: 404 });
  });
});

describe("the conversation view", () => {
  test("shows both sides in order with the model Cortex recorded, and leaves tool entries out", () => {
    const html = wrap(<ExchangeView exchange={exchange} />);
    expect(html.indexOf("Which hire first?")).toBeLessThan(html.indexOf("The designer first."));
    expect(html).toContain("the assistant · pi/claude-sonnet");
    expect(html).not.toContain("tool noise");
    expect(lines(entries).length).toBe(2);
  });

  test("shows the sent message while the answer is on its way", () => {
    const html = wrap(<ExchangeView exchange={{ ...exchange, entries: [], working: true }} outbox="Hello" />);
    expect(html).toContain("Hello");
    expect(html).toContain("The assistant is answering");
  });

  test("shows a failed turn's error text", () => {
    const html = wrap(<ExchangeView exchange={{ ...exchange, entries: [{ id: "9", kind: "m", role: "assistant", error: "the turn failed" }] }} />);
    expect(html).toContain("the turn failed");
  });
});

describe("discussing a note", () => {
  const session: StudioSession = { id: "s", phase: { kind: "open" }, turns: [{ id: "t", text: "Why?", answer: { reply: "Because." }, model: "pi/x" }] };

  test("shows the turns with the model", () => {
    const html = wrap(<SessionView session={session} />);
    expect(html).toContain("Because.");
    expect(html).toContain("the assistant · pi/x");
  });

  test("an open note offers Discuss, now live", () => {
    const html = wrap(
      <QueueContext.Provider value={{ client: createMemoryClient(), refresh: () => {} }}>
        <StudioOpen thread={budgetThread} waits onHide={() => {}} />
      </QueueContext.Provider>,
    );
    expect(html).toContain(">Discuss<");
    expect(html).not.toContain("disabled=\"\" title");
  });
});

describe("the surfaces drive the named calls", () => {
  const session: StudioSession = { id: "s", phase: { kind: "open" }, turns: [{ id: "t", text: "Why?", answer: { reply: "Because." }, model: "pi/x" }] };
  let mounted: MountedDom | null = null;
  afterEach(async () => {
    await mounted?.cleanup();
    mounted = null;
  });

  async function show(node: React.ReactNode, client: MemoryClient) {
    mounted = mountDom();
    await act(async () => {
      mounted!.root.render(
        <I18nProvider value={createI18n("en")}>
          <QueueContext.Provider value={{ client, refresh: () => {} }}>{node}</QueueContext.Provider>
        </I18nProvider>,
      );
    });
    return mounted.container;
  }
  const typeInto = (field: HTMLTextAreaElement, text: string) =>
    act(async () => {
      const key = Object.keys(field).find((k) => k.startsWith("__reactProps$"))!;
      (field as unknown as Record<string, { onChange: (e: unknown) => void }>)[key].onChange({ target: { value: text }, currentTarget: { value: text } });
    });
  const click = (container: HTMLElement, label: string) =>
    act(async () => {
      Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label)!.click();
    });

  test("with no lane, starting a conversation shows Cortex's refusal", async () => {
    const client = createMemoryClient();
    client.seed("conversations.source", { ok: true, data: { conversations: [] } });
    client.seed("conversations.start", { ok: false, message: "No conversation model is configured. Nothing was sent.", status: 503 });
    const container = await show(<TalkItThrough thread="budget-next-year" />, client);
    await click(container, "Talk it through");
    expect(container.textContent).toContain("No conversation model is configured. Nothing was sent.");
    expect(client.calls.map((c) => c.name)).toEqual(["conversations.source", "conversations.start"]);
    expect(client.calls[1]?.args[0]).toBe("budget-next-year");
  });

  test("a message that got no answer is sent again with the same input id", async () => {
    const client = createMemoryClient();
    client.seed("conversations.source", { ok: true, data: { conversations: [meta] } });
    client.seed("conversations.detail", { ok: true, data: { conversation: meta, models: { using: null }, pending: [] } });
    client.seed("conversations.entries", { ok: true, data: { entries: [] } });
    client.seed("conversations.send", { ok: false, message: null, status: 0 });
    const container = await show(<TalkItThrough thread="budget-next-year" />, client);
    await click(container, "Continue the conversation");
    await typeInto(container.querySelector("textarea")!, "Which hire first?");
    await click(container, "Send");
    await click(container, "Send");
    const sends = client.calls.filter((c) => c.name === "conversations.send");
    expect(sends).toHaveLength(2);
    expect(sends[1]?.args).toEqual(sends[0]?.args);
    expect(sends[0]?.args[2]).toBe("Which hire first?");
  });

  test("a turn that got no answer is said again with the same turn id, and a refusal shows Cortex's text", async () => {
    const client = createMemoryClient();
    client.seed("studio.session", { ok: true, data: { session } });
    const container = await show(<DiscussNote thread="budget-next-year" note="2026-11-13T03:14:00Z" />, client);
    await click(container, "Discuss");
    expect(client.calls[0]?.args[0]).toMatchObject({ action: "start", thread: "budget-next-year", scope: { kind: "ghost", note: "2026-11-13T03:14:00Z" } });
    client.seed("studio.session", { ok: false, message: null, status: 0 });
    await typeInto(container.querySelector("textarea")!, "Why?");
    await click(container, "Send");
    await click(container, "Send");
    const says = client.calls.map((c) => c.args[0] as { action: string; turn?: string }).filter((a) => a.action === "say");
    expect(says).toHaveLength(2);
    expect(says[1]?.turn).toBe(says[0]?.turn);
    client.seed("studio.session", { ok: false, message: "The session is closed.", status: 409 });
    await click(container, "Send");
    expect(container.textContent).toContain("The session is closed.");
  });
});

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { linkedConversation, lines, readExchange, sendInput, sessionCall, startConversation, type Exchange, type StudioSession } from "../src/ui/api/conversations";
import { createClient, type Fetch } from "../src/ui/api/client";
import { QueueContext } from "../src/ui/cards/act";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { ExchangeView, SessionView } from "../src/ui/studio/conversation";
import { StudioCard } from "../src/ui/studio/card";
import { budgetThread } from "./fixtures/studio";

const meta = { id: "c1", title: "What goes into next year's budget?", activity: { lastAt: "2026-11-14T08:00:00Z", status: "idle" as const } };
const entries = [
  { id: "1", kind: "cortex.input", role: "user" as const, text: "Which hire first?" },
  { id: "2", kind: "message", role: "tool" as const, text: "tool noise" },
  { id: "3", kind: "message", role: "assistant" as const, text: "The designer first.", model: "pi/claude-sonnet" },
];
const exchange: Exchange = { conversation: meta, using: "pi/claude-sonnet", entries, working: false };

function recorder(answer: (path: string, init?: RequestInit) => Response) {
  const calls: { path: string; method: string; body: unknown }[] = [];
  const fetch: Fetch = async (path, init) => {
    calls.push({ path, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return answer(path, init);
  };
  return { client: createClient(fetch), calls };
}
const json = (body: unknown, status = 200) => Response.json(body, { status });
const wrap = (node: React.ReactNode) => renderToStaticMarkup(<I18nProvider value={createI18n("en")}>{node}</I18nProvider>);

describe("the conversation client", () => {
  test("starts a conversation with the thread as source", async () => {
    const { client, calls } = recorder(() => json({ ok: true, conversation: meta }, 201));
    const r = await startConversation(client, "budget-next-year", "5b6f0d6e-0000-4000-8000-000000000001");
    expect(r.ok).toBe(true);
    expect(calls).toEqual([{ path: "/api/conversations/starts", method: "POST", body: { startId: "5b6f0d6e-0000-4000-8000-000000000001", source: { owner: "studio-thread", id: "budget-next-year" } } }]);
  });

  test("a thread with a conversation offers that one", async () => {
    const { client, calls } = recorder(() => json({ ok: true, conversations: [meta, { ...meta, id: "old" }] }));
    expect(await linkedConversation(client, "budget-next-year")).toBe("c1");
    expect(calls[0]?.path).toBe("/api/conversations/source?owner=studio-thread&id=budget-next-year");
  });

  test("a thread without one, or a failed lookup, offers none", async () => {
    expect(await linkedConversation(recorder(() => json({ ok: true, conversations: [] })).client, "t")).toBeNull();
    expect(await linkedConversation(recorder(() => json({ ok: false, error: "no" }, 503)).client, "t")).toBeNull();
  });

  test("with no lane, the refusal comes back as Cortex wrote it", async () => {
    const { client, calls } = recorder(() => json({ ok: false, error: "No conversation model is configured." }, 503));
    const r = await startConversation(client, "t", "5b6f0d6e-0000-4000-8000-000000000001");
    expect(r).toEqual({ ok: false, message: "No conversation model is configured.", status: 503 });
    expect(calls.length).toBe(1);
  });

  test("a message goes to the conversation as web input", async () => {
    const { client, calls } = recorder(() => json({ ok: true }, 202));
    await sendInput(client, "c1", "in-1", "Which hire first?");
    expect(calls[0]).toEqual({ path: "/api/conversations/c1", method: "POST", body: { inputId: "in-1", transport: "web", text: "Which hire first?", mode: "queue" } });
  });

  test("reading joins the detail and the entries, and is working while an input is queued", async () => {
    const { client } = recorder((path) =>
      path.endsWith("/entries?limit=500") ? json({ ok: true, entries }) : json({ ok: true, conversation: meta, models: { using: "pi/claude-sonnet" }, pending: [{ inputId: "in-1", status: "queued" }] }),
    );
    const r = await readExchange(client, "c1");
    expect(r.ok && r.data.working).toBe(true);
    expect(r.ok && r.data.entries.length).toBe(3);
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

  test("starts a session scoped to the note and says a turn", async () => {
    const { client, calls } = recorder(() => json({ ok: true, session }));
    await sessionCall(client, { action: "start", id: "s", thread: "budget-next-year", scope: { kind: "ghost", note: "2026-11-13T03:14:00Z" } });
    await sessionCall(client, { action: "say", id: "s", turn: "t", text: "Why?" });
    expect(calls.map((c) => [c.path, (c.body as { action: string }).action])).toEqual([["/api/desk/studio/session", "start"], ["/api/desk/studio/session", "say"]]);
  });

  test("shows the turns with the model", () => {
    const html = wrap(<SessionView session={session} />);
    expect(html).toContain("Because.");
    expect(html).toContain("the assistant · pi/x");
  });

  test("an open note offers Discuss, now live", () => {
    const html = wrap(
      <QueueContext.Provider value={{ client: createClient(async () => new Response("{}")), refresh: () => {} }}>
        <StudioCard thread={budgetThread} waits open onOpen={() => {}} onHide={() => {}} />
      </QueueContext.Provider>,
    );
    expect(html).toContain(">Discuss<");
    expect(html).not.toContain("disabled=\"\" title");
  });
});

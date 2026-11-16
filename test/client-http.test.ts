import { describe, expect, test } from "bun:test";
import { createClient, type DeskClient } from "../src/ui/api/client";
import { createMemoryClient } from "../src/ui/api/memory-client";

interface Sent {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
}

function stub(respond: () => Response = () => Response.json({ ok: true })) {
  const sent: Sent[] = [];
  const client = createClient(async (url, init) => {
    sent.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
    return respond();
  });
  return { client, sent };
}

const DASHED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PLAIN = /^[0-9a-f]{32}$/;
const act = { kind: "close", thread: "t", outcome: "done" } as never;
const ID = "11111111-2222-3333-4444-555555555555";

type Case = [string, (c: DeskClient) => unknown, string, string, Record<string, unknown> | undefined];

const reads: Case[] = [
  ["desk", (c) => c.desk(), "GET", "/api/desk", undefined],
  ["queue.desk", (c) => c.queue.desk(), "GET", "/api/desk", undefined],
  ["mail.rules", (c) => c.mail.rules(), "GET", "/api/desk/mail/rules", undefined],
  ["rules", (c) => c.rules(), "GET", "/api/desk/mail/rules", undefined],
  ["myDay", (c) => c.myDay(), "GET", "/api/desk/my-day", undefined],
  ["myDay.outline", (c) => c.myDay.outline(), "GET", "/api/desk/my-day", undefined],
  ["studio", (c) => c.studio(), "GET", "/api/desk/studio", undefined],
  ["studio.list", (c) => c.studio.list(), "GET", "/api/desk/studio", undefined],
  ["conversations.source", (c) => c.conversations.source("a b"), "GET", "/api/conversations/source?owner=studio-thread&id=a%20b", undefined],
  ["conversations.detail", (c) => c.conversations.detail("c/1"), "GET", "/api/conversations/c%2F1", undefined],
  ["conversations.entries", (c) => c.conversations.entries("c1"), "GET", "/api/conversations/c1/entries?limit=500", undefined],
  ["handshake", (c) => c.handshake(), "GET", "/api/desk/handshake", undefined],
];

const writes: Case[] = [
  ["queue.ruling", (c) => c.queue.ruling("k", "yes", ID), "POST", "/api/desk/ruling", { key: "k", text: "yes", requestId: ID }],
  ["queue.action", (c) => c.queue.action("a", "k"), "POST", "/api/desk/action", { action: "a", key: "k" }],
  [
    "queue.interruptionFeedback",
    (c) => c.queue.interruptionFeedback({ key: "k", code: "vip", important: true }),
    "POST",
    "/api/desk/interruptions/feedback",
    { key: "k", code: "vip", important: true },
  ],
  ["mail.rule", (c) => c.mail.rule("p", "later"), "POST", "/api/desk/mail/rules", { op: "later", proposal: "p" }],
  ["mail.send", (c) => c.mail.send({ action: "move", key: "k", target: "archive" }), "POST", "/api/desk/mail", { action: "move", key: "k", target: "archive" }],
  [
    "mail.inviteReply",
    (c) => c.mail.inviteReply("k", "accept", ID),
    "POST",
    "/api/desk/mail",
    { action: "invite.reply", key: "k", reply: "accept", requestId: ID, commitment: null, confirmed: true },
  ],
  [
    "mail.studioAdd",
    (c) => c.mail.studioAdd("k", "slug", "why", "abc12345"),
    "POST",
    "/api/desk/mail",
    { action: "studio.add", key: "k", requestId: "abc12345", thread: "slug", includeText: false, reason: "why" },
  ],
  ["myDay.change", (c) => c.myDay.change("2026-11-16", { op: "todo", key: "k", fingerprint: "f" } as never, ID), "POST", "/api/desk/my-day", { date: "2026-11-16", requestId: ID, command: { op: "todo", key: "k", fingerprint: "f" } }],
  ["changeMyDay", (c) => c.changeMyDay("2026-11-16", { op: "todo", key: "k", fingerprint: "f" } as never), "POST", "/api/desk/my-day", undefined],
  ["capture.ask", (c) => c.capture.ask("hi"), "POST", "/api/desk/ask", { text: "hi" }],
  ["capture.create", (c) => c.capture.create("capture", { text: "x" }, "abc12345"), "POST", "/api/desk/create", { requestId: "abc12345", kind: "capture", fields: { text: "x" } }],
  ["capture.undo", (c) => c.capture.undo({ id: "capture-1", requestId: "r1" }), "POST", "/api/desk/capture/undo", { id: "capture-1", requestId: "r1" }],
  ["studio.act", (c) => c.studio.act(act, "abc12345"), "POST", "/api/desk/studio/act", { ...(act as object), requestId: "abc12345" }],
  [
    "studio.session",
    (c) => c.studio.session({ action: "say", id: "s", turn: "t", text: "x" }),
    "POST",
    "/api/desk/studio/session",
    { action: "say", id: "s", turn: "t", text: "x" },
  ],
  ["conversations.ask", (c) => c.conversations.ask("q", ID), "POST", "/api/conversations/asks", { text: "q", startId: ID }],
  ["conversations.start", (c) => c.conversations.start("th", ID), "POST", "/api/conversations/starts", { startId: ID, source: { owner: "studio-thread", id: "th" } }],
  ["conversations.send", (c) => c.conversations.send("c1", "in1", "hello"), "POST", "/api/conversations/c1", { inputId: "in1", transport: "web", text: "hello", mode: "queue" }],
  ["outline.ask", (c) => c.outline.ask({ row: "r", kind: "answer", question: "q" }, ID), "POST", "/api/desk/outline/ask", { requestId: ID, row: "r", kind: "answer", question: "q" }],
];

describe("HTTP adapter sends what the call sites send", () => {
  for (const [name, run, method, url, body] of [...reads, ...writes]) {
    test(name, async () => {
      const { client, sent } = stub();
      await run(client);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.method).toBe(method);
      expect(sent[0]?.url).toBe(url);
      if (body) expect(sent[0]?.body).toEqual(body);
    });
  }
});

describe("request ids", () => {
  const minted: [string, (c: DeskClient) => unknown, RegExp][] = [
    ["myDay.change", (c) => c.myDay.change("2026-11-16", {} as never), DASHED],
    ["mail.inviteReply", (c) => c.mail.inviteReply("k", "accept"), DASHED],
    ["outline.ask", (c) => c.outline.ask({ row: "r", kind: "answer" }), DASHED],
    ["conversations.start", (c) => c.conversations.start("t"), DASHED],
    ["conversations.ask", (c) => c.conversations.ask("q"), DASHED],
    ["queue.ruling", (c) => c.queue.ruling("k", "t"), PLAIN],
    ["mail.studioAdd", (c) => c.mail.studioAdd("k", null), PLAIN],
    ["capture.create", (c) => c.capture.create("capture", {}), PLAIN],
    ["studio.act", (c) => c.studio.act(act), PLAIN],
  ];
  for (const [name, run, format] of minted) {
    test(`${name} mints a fresh id in the route's format`, async () => {
      const { client, sent } = stub();
      await run(client);
      await run(client);
      const ids = sent.map((s) => String(s.body?.requestId ?? s.body?.startId));
      expect(ids[0]).toMatch(format);
      expect(ids[1]).toMatch(format);
      expect(ids[0]).not.toBe(ids[1]);
    });
  }

  test("a given id is sent as it is", async () => {
    const { client, sent } = stub();
    await client.studio.act(act, "keep-this-id");
    await client.myDay.change("2026-11-16", {} as never, ID);
    expect(sent.map((s) => s.body?.requestId)).toEqual(["keep-this-id", ID]);
  });
});

describe("failures", () => {
  test("a rejected fetch is a status 0 error", async () => {
    const client = createClient(async () => {
      throw new Error("down");
    });
    expect(await client.queue.desk()).toEqual({ ok: false, message: null, status: 0 });
    expect(await client.capture.ask("x")).toEqual({ ok: false, message: null, status: 0 });
  });

  test("a response that is not JSON keeps its status", async () => {
    const { client } = stub(() => new Response("<html>", { status: 200 }));
    expect(await client.mail.rules()).toEqual({ ok: false, message: null, status: 200 });
  });

  test("an error response carries Cortex's text", async () => {
    const { client } = stub(() => Response.json({ error: "No." }, { status: 503 }));
    expect(await client.conversations.ask("x")).toEqual({ ok: false, message: "No.", status: 503 });
  });
});

describe("memory adapter", () => {
  test("a seeded call answers and is logged", async () => {
    const memory = createMemoryClient();
    memory.seed("queue.action", { ok: true, data: { done: 1 } });
    expect(await memory.queue.action("a", "k")).toEqual({ ok: true, data: { done: 1 } });
    expect(memory.calls).toEqual([{ name: "queue.action", args: ["a", "k"] }]);
  });

  test("an unseeded call fails visibly and is still logged", async () => {
    const memory = createMemoryClient();
    memory.seed("queue.action", { ok: true, data: {} });
    expect(await memory.capture.ask("x")).toEqual({ ok: false, message: null, status: 0 });
    expect(await memory.myDay()).toEqual({ ok: false, message: null, status: 0 });
    expect(memory.calls.map((c) => c.name)).toEqual(["capture.ask", "myDay"]);
  });

  test("a seeded function sees the arguments", async () => {
    const memory = createMemoryClient();
    memory.seed("conversations.detail", (id: string) => ({ ok: false, message: id, status: 404 }));
    expect(await memory.conversations.detail("c9")).toEqual({ ok: false, message: "c9", status: 404 });
  });
});

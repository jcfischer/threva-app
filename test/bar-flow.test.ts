import { describe, expect, test } from "bun:test";
import { createClient, type Fetch } from "../src/ui/api/client";
import { filesAtOnce, type Proposal } from "../src/ui/api/capture";
import { takeAsk, takeNote } from "../src/ui/bar/bar";
import type { BarEvent } from "../src/ui/bar/state";

function recorder(answer: (path: string, body: Record<string, unknown>) => unknown) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const fetchImpl: Fetch = async (path, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({ path, body });
    const result = answer(path, body);
    return result instanceof Response ? result : Response.json(result);
  };
  return { calls, client: createClient(fetchImpl) };
}

const capture: Proposal = { kind: "capture", label: "Capture", fields: { text: "Empty places" }, automatic: true };

describe("filing a note at once", () => {
  test("only a capture Cortex marked automatic is filed without the card", () => {
    expect(filesAtOnce(capture)).toBe(true);
    expect(filesAtOnce({ ...capture, automatic: false })).toBe(false);
    expect(filesAtOnce({ ...capture, kind: "task" })).toBe(false);
    expect(filesAtOnce({ ...capture, problem: "The Studio is turned off." })).toBe(false);
  });

  test("an automatic capture goes straight to the Desk and leaves Undo", async () => {
    const { calls, client } = recorder((path) => (path === "/api/desk/ask" ? { ok: true, proposal: capture } : { ok: true, id: "c1", message: "Filed." }));
    const events: BarEvent[] = [];
    let refreshed = 0;
    await takeNote(client, "  Empty places  ", (e) => events.push(e), () => (refreshed += 1));
    expect(events.map((e) => e.type)).toEqual(["submit", "proposed", "keep", "created"]);
    expect(calls.map((c) => c.path)).toEqual(["/api/desk/ask", "/api/desk/create"]);
    expect(calls[0].body).toEqual({ text: "Empty places" });
    expect(calls[1].body).toMatchObject({ kind: "capture", fields: { text: "Empty places" } });
    const created = events[3];
    expect(created.type).toBe("created");
    if (created.type !== "created") return;
    expect(created.message).toBe("");
    expect(created.undo).toEqual({ id: "c1", requestId: String(calls[1].body.requestId) });
    expect(refreshed).toBe(1);
  });

  test("a proposal Cortex did not mark automatic keeps its card", async () => {
    const plain: Proposal = { kind: "capture", label: "Capture", fields: { text: "Empty places" } };
    const { calls, client } = recorder(() => ({ ok: true, proposal: plain }));
    const events: BarEvent[] = [];
    await takeNote(client, "Empty places", (e) => events.push(e), () => {});
    expect(events.map((e) => e.type)).toEqual(["submit", "proposed"]);
    expect(calls.map((c) => c.path)).toEqual(["/api/desk/ask"]);
  });

  test("a failing create reports Cortex's message and leaves the text", async () => {
    const { client } = recorder((path) => (path === "/api/desk/ask" ? { ok: true, proposal: capture } : new Response(JSON.stringify({ error: "The Studio is turned off." }), { status: 409 })));
    const events: BarEvent[] = [];
    await takeNote(client, "Empty places", (e) => events.push(e), () => {});
    expect(events.map((e) => e.type)).toEqual(["submit", "proposed", "keep", "failed"]);
  });

  test("a refused ask stops before the card", async () => {
    const { client } = recorder(() => new Response(JSON.stringify({ error: "No conversation model is configured. Nothing was sent." }), { status: 503 }));
    const events: BarEvent[] = [];
    await takeNote(client, "Empty places", (e) => events.push(e), () => {});
    expect(events).toEqual([{ type: "submit" }, { type: "failed", message: "No conversation model is configured. Nothing was sent." }]);
  });

  test("an empty bar sends nothing", async () => {
    const { calls, client } = recorder(() => ({ ok: true }));
    const events: BarEvent[] = [];
    await takeNote(client, "   ", (e) => events.push(e), () => {});
    await takeAsk(client, "   ", (e) => events.push(e));
    expect(events).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe("starting the conversation from the ask row", () => {
  test("posts the text with a start id and reports that it started", async () => {
    const { calls, client } = recorder(() => ({ ok: true }));
    const events: BarEvent[] = [];
    await takeAsk(client, " is the workshop done? ", (e) => events.push(e));
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("/api/conversations/asks");
    expect(calls[0].body.text).toBe("is the workshop done?");
    expect(typeof calls[0].body.startId).toBe("string");
    expect(events.map((e) => e.type)).toEqual(["ask", "started"]);
  });

  test("a refusal shows Cortex's message", async () => {
    const { client } = recorder(() => new Response(JSON.stringify({ error: "No conversation model is configured. Nothing was sent." }), { status: 503 }));
    const events: BarEvent[] = [];
    await takeAsk(client, "is the workshop done?", (e) => events.push(e));
    expect(events).toEqual([{ type: "ask" }, { type: "failed", message: "No conversation model is configured. Nothing was sent." }]);
  });
});

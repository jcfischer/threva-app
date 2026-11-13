import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { captureText, NOT_A_CARD } from "../src/ui/api/capture";
import { createClient, type Fetch } from "../src/ui/api/client";
import type { DeskEvent } from "../src/ui/api/types";
import { QueueContext } from "../src/ui/cards/act";
import { AfterMeetingCard, MeetingSoonCard } from "../src/ui/cards/meeting-cards";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { buildQueue, EMPTY_SESSION } from "../src/ui/queue/order";
import { item, NOW, view } from "./fixtures/desk";

const MIN = 60_000;

const event = (key: string, at: number, end: number, extra: Partial<DeskEvent> = {}): DeskEvent => ({ key, at, end, title: `Meeting ${key}`, kind: "meeting", ...extra });

const wrap = (node: React.ReactNode, locale: "en" | "de" = "en") =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <QueueContext.Provider value={{ client: createClient(async () => new Response("{}")), refresh: () => {} }}>{node}</QueueContext.Provider>
    </I18nProvider>,
  );

describe("meetings in the queue", () => {
  const desk = view({
    items: [item({ key: "agent", kind: "decision" }), item({ key: "meet", kind: "meeting", eventKey: "e-soon" })],
    today: [event("e-soon", NOW + 5 * MIN, NOW + 35 * MIN), event("e-ended", NOW - 60 * MIN, NOW - 10 * MIN), event("e-old", NOW - 3 * 60 * MIN, NOW - 2 * 60 * MIN)],
  });

  test("a meeting soon comes first, then a meeting that ended within the hour", () => {
    expect(buildQueue(desk, null, EMPTY_SESSION, NOW).map((e) => e.k)).toEqual(["i:meet", "a:e-ended", "i:agent"]);
  });

  test("a dismissed meeting no longer shows its after-meeting card", () => {
    expect(buildQueue(desk, null, EMPTY_SESSION, NOW, ["e-ended"]).map((e) => e.k)).toEqual(["i:meet", "i:agent"]);
  });

  test("the meeting-soon card shows the event and a join link", () => {
    const html = wrap(<MeetingSoonCard item={item({ key: "meet", kind: "meeting", why: "It starts in 5 minutes." })} event={event("e", NOW + 5 * MIN, NOW + 35 * MIN, { url: "https://meet.example.org/x", online: true })} />);
    expect(html).toContain("Meeting e");
    expect(html).toContain("It starts in 5 minutes.");
    expect(html).toContain('href="https://meet.example.org/x"');
  });

  test("the after-meeting card asks what to note, in German too", () => {
    const ended = event("e", NOW - 60 * MIN, NOW - 10 * MIN);
    expect(wrap(<AfterMeetingCard event={ended} onDismiss={() => {}} />)).toContain("Anything to note?");
    expect(wrap(<AfterMeetingCard event={ended} onDismiss={() => {}} />, "de")).toContain("Nichts zu notieren");
  });
});

describe("captureText", () => {
  const stub = (answers: Record<string, Response>): Fetch => async (input) => answers[input] ?? new Response("{}", { status: 404 });

  test("asks, then creates the proposed card", async () => {
    const result = await captureText(
      createClient(stub({
        "/api/desk/ask": Response.json({ ok: true, proposal: { kind: "task", label: "Task", fields: { title: "Send minutes" } } }),
        "/api/desk/create": Response.json({ ok: true, id: "t1", message: "Filed." }),
      })),
      "Send minutes",
    );
    expect(result).toEqual({ ok: true, data: { ok: true, id: "t1", message: "Filed." } as never });
  });

  test("a conversation proposal is not created", async () => {
    const result = await captureText(createClient(stub({ "/api/desk/ask": Response.json({ ok: true, proposal: { kind: "conversation", label: "Conversation", fields: {} } }) })), "Why?");
    expect(result).toEqual({ ok: false, message: null, status: NOT_A_CARD });
  });

  test("Cortex's error on create comes back", async () => {
    const result = await captureText(
      createClient(stub({
        "/api/desk/ask": Response.json({ ok: true, proposal: { kind: "note", label: "Note", fields: { text: "x" } } }),
        "/api/desk/create": Response.json({ ok: false, error: "Notes are not set up on this stack." }, { status: 409 }),
      })),
      "x",
    );
    expect(result).toEqual({ ok: false, message: "Notes are not set up on this stack.", status: 409 });
  });
});

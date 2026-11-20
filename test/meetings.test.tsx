import { act } from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { captureText, NOT_A_CARD } from "@desk/capture";
import { createMemoryClient } from "@desk/memory-client";
import type { DeskEvent } from "@desk/types";
import { QueueContext } from "../src/ui/cards/act";
import { AfterMeetingCard, MeetingSoonCard } from "../src/ui/cards/meeting-cards";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { QueueView } from "../src/ui/queue/queue-view";
import { buildQueue, EMPTY_SESSION } from "../src/ui/queue/order";
import { mountDom } from "./fixtures/dom";
import { afterMeeting, item, NOW, view } from "./fixtures/desk";

const MIN = 60_000;

const event = (key: string, at: number, end: number, extra: Partial<DeskEvent> = {}): DeskEvent => ({ key, at, end, title: `Meeting ${key}`, kind: "meeting", ...extra });

const wrap = (node: React.ReactNode, locale: "en" | "de" = "en") =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <QueueContext.Provider value={{ client: createMemoryClient(), refresh: () => {} }}>{node}</QueueContext.Provider>
    </I18nProvider>,
  );

describe("meetings in the queue", () => {
  const desk = view({
    items: [afterMeeting("e-ended", "Meeting e-ended"), item({ key: "agent", kind: "decision" }), item({ key: "meet", kind: "meeting", eventKey: "e-soon" })],
    today: [event("e-soon", NOW + 5 * MIN, NOW + 35 * MIN), event("e-ended", NOW - 60 * MIN, NOW - 10 * MIN), event("e-old", NOW - 3 * 60 * MIN, NOW - 2 * 60 * MIN)],
  });

  test("a meeting soon comes first, then the server-supplied after-meeting card", () => {
    expect(buildQueue(desk, null, EMPTY_SESSION, NOW).map((e) => e.k)).toEqual(["i:meet", "i:after-e-ended", "i:agent"]);
  });

  test("a dismissed meeting no longer shows its after-meeting card", () => {
    expect(buildQueue({ ...desk, items: desk.items.filter(({ kind }) => kind !== "meeting-after") }, null, EMPTY_SESSION, NOW).map((e) => e.k)).toEqual(["i:meet", "i:agent"]);
  });

  test("the meeting-soon card shows the event and a join link", () => {
    const html = wrap(<MeetingSoonCard item={item({ key: "meet", kind: "meeting", why: "It starts in 5 minutes." })} event={event("e", NOW + 5 * MIN, NOW + 35 * MIN, { url: "https://meet.example.org/x", online: true })} />);
    expect(html).toContain("Meeting e");
    expect(html).toContain("It starts in 5 minutes.");
    expect(html).toContain('href="https://meet.example.org/x"');
  });

  test("the after-meeting card asks what to note, in German too", () => {
    const ended = afterMeeting("e", "Meeting e");
    expect(wrap(<AfterMeetingCard item={ended} onDismiss={() => {}} />)).toContain("Anything to note?");
    expect(wrap(<AfterMeetingCard item={ended} onDismiss={() => {}} />, "de")).toContain("Nichts zu notieren");
  });
});

describe("captureText", () => {
  test("asks, then creates the proposed card", async () => {
    const client = createMemoryClient();
    client.seed("capture.ask", { ok: true, data: { proposal: { kind: "task", label: "Task", fields: { title: "Send minutes" } } } });
    client.seed("capture.create", { ok: true, data: { ok: true, id: "t1", message: "Filed." } });
    const result = await captureText(client, "Send minutes");
    expect(result).toEqual({ ok: true, data: { ok: true, id: "t1", message: "Filed." } as never });
    expect(client.calls.map((call) => call.name)).toEqual(["capture.ask", "capture.create"]);
  });

  test("a conversation proposal is not created", async () => {
    const client = createMemoryClient();
    client.seed("capture.ask", { ok: true, data: { proposal: { kind: "conversation", label: "Conversation", fields: {} } } });
    const result = await captureText(client, "Why?");
    expect(result).toEqual({ ok: false, message: null, status: NOT_A_CARD });
    expect(client.calls.map((call) => call.name)).toEqual(["capture.ask"]);
  });

  test("Cortex's error on create comes back", async () => {
    const client = createMemoryClient();
    client.seed("capture.ask", { ok: true, data: { proposal: { kind: "note", label: "Note", fields: { text: "x" } } } });
    client.seed("capture.create", { ok: false, message: "Notes are not set up on this stack.", status: 409 });
    const result = await captureText(client, "x");
    expect(result).toEqual({ ok: false, message: "Notes are not set up on this stack.", status: 409 });
    expect(client.calls.map((call) => call.name)).toEqual(["capture.ask", "capture.create"]);
  });
});

test("only a successful dismissal refreshes the queue", async () => {
  const dom = mountDom();
  try {
    const client = createMemoryClient();
    const ended = afterMeeting("e-ended", "Board call");
    const render = (items: typeof ended[]) => {
      dom.root.render(
        <I18nProvider value={createI18n("en")}>
          <QueueView client={client} state={{ view: view({ items }), studio: null, error: null, refresh: () => render([]) }}
            session={EMPTY_SESSION} setSession={() => {}} now={NOW} />
        </I18nProvider>,
      );
    };
    await act(async () => { render([ended]); });
    const dismiss = () => [...dom.container.querySelectorAll("button")].find((button) => button.textContent === "Nothing to note");
    await act(async () => { dismiss()!.click(); });
    expect(dom.container.querySelector('[role="alert"]')?.textContent).toBe("The meeting could not be dismissed. Try again.");
    expect(dismiss()).toBeDefined();
    client.seed("queue.action", { ok: true, data: {} });
    await act(async () => { dismiss()!.click(); });
    expect(dismiss()).toBeUndefined();
    expect(client.calls).toEqual(Array.from({ length: 2 }, () => ({ name: "queue.action", args: ["meeting.dismiss", ended.key] })));
  } finally {
    await dom.cleanup();
  }
});

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DayView } from "../src/ui/app";
import { createClient } from "../src/ui/api/client";
import type { DeskView, MailSweep } from "../src/ui/api/types";
import { inboxCard, meetingCard } from "../src/ui/queue/around";
import { buildQueue, EMPTY_SESSION, pin, type Session } from "../src/ui/queue/order";
import { NOW, item, view } from "./fixtures/desk";

const MIN = 60_000;
const group: MailSweep = { id: "news", kind: "sweep", target: "archive", label: "Newsletters", title: "Weekly news", why: "Unread.", mails: [] };
const desk = view({
  items: [item({ key: "soon-card", kind: "meeting", eventKey: "soon", title: "Team standup" }), item({ key: "mail", kind: "mail", title: "Workshop dates" })],
  today: [
    { key: "ended", kind: "meeting", title: "Board call", at: NOW - 60 * MIN, end: NOW - 5 * MIN },
    { key: "soon", kind: "meeting", title: "Team standup", at: NOW + 10 * MIN, end: NOW + 40 * MIN },
    { key: "later", kind: "meeting", title: "Later meeting", at: NOW + 120 * MIN, end: NOW + 150 * MIN },
  ],
  mailSweeps: [group],
  myDay: { items: [{ task: { id: "task", title: "Write the report" }, areaTitle: "Work" }] },
});

const render = (data: DeskView = desk, session: Session = EMPTY_SESSION, now = NOW, dismissed: string[] = []) => renderToStaticMarkup(
  <DayView client={createClient(async () => new Response("{}"))} state={{ view: data, studio: null, error: null, refresh: () => {} }} session={session} setSession={() => {}} now={now} dismissed={dismissed} />,
);

describe("the day around the card", () => {
  test("keeps the queue before a rail containing the timeline then the footer", () => {
    const html = render();
    expect(html).toContain('<div class="daygrid one"><section class="cards"');
    expect(html.indexOf('class="cards"')).toBeLessThan(html.indexOf('<aside class="rail">'));
    expect(html.indexOf('aria-label="Today"')).toBeLessThan(html.indexOf("Inbox"));
  });

  test("task chips pull their task in a free slot and when still open after the day", () => {
    expect(render()).toContain('<button class="chip" type="button"><span>Write the report</span>');
    const late = render(desk, EMPTY_SESSION, NOW + 12 * 60 * MIN);
    expect(late).toContain("Still open today");
    expect(late).toContain('<button class="chip" type="button"><span>Write the report</span>');
    expect(render(desk, pin(EMPTY_SESSION, "d:task"))).toContain('<span class="q">Write the report</span>');
    expect(render(desk, pin(EMPTY_SESSION, "d:task"))).toContain("Let it move");
  });

  test("only meetings with cards are buttons; dismissed after-meetings lose their button", () => {
    const html = render();
    expect(html).toMatch(/<button type="button" class="slot ev past">[^]*?<b>Board call<\/b>[^]*?<\/button>/);
    expect(html).toMatch(/<button type="button" class="slot ev">[^]*?<b>Team standup<\/b>[^]*?<\/button>/);
    expect(html).toMatch(/<div class="slot ev">[^]*?<b>Later meeting<\/b>[^]*?<\/div>/);
    expect(render(desk, EMPTY_SESSION, NOW, ["ended"])).toMatch(/<div class="slot ev past">[^]*?<b>Board call<\/b>[^]*?<\/div>/);
    const queue = buildQueue(desk, null, EMPTY_SESSION, NOW);
    expect(meetingCard(queue, "later")).toBeUndefined();
    for (const [eventKey, expected] of [["soon", "i:soon-card"], ["ended", "a:ended"]]) {
      const target = meetingCard(queue, eventKey);
      expect(target?.k).toBe(expected);
      expect(buildQueue(desk, null, pin(EMPTY_SESSION, target!.k), NOW)[0]?.k).toBe(expected);
    }
  });

  test("Inbox prefers the first sweep, then mail, including digests; a clear inbox is plain text", () => {
    expect(render()).toContain('<button type="button" class="slot" style="grid-template-columns:minmax(0,1fr)"><span><b>Inbox</b>');
    const queue = buildQueue(desk, null, pin(EMPTY_SESSION, "i:mail"), NOW);
    expect(inboxCard(queue)?.k).toBe("s:news");
    expect(buildQueue(desk, null, pin(EMPTY_SESSION, inboxCard(queue)!.k), NOW)[0]?.k).toBe("s:news");
    const mailOnly = view({ items: desk.items });
    expect(inboxCard(buildQueue(mailOnly, null, EMPTY_SESSION, NOW))?.k).toBe("i:mail");
    const digestOnly = view({ mailDigests: [group] });
    expect(inboxCard(buildQueue(digestOnly, null, EMPTY_SESSION, NOW))?.k).toBe("s:news");
    expect(inboxCard([])).toBeUndefined();
    expect(render(view())).toContain('<div class="slot" style="grid-template-columns:minmax(0,1fr)"><span><b>Inbox</b>');
  });
});

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DayView } from "../src/ui/app";
import { createClient } from "../src/ui/api/client";
import type { DeskView, MailSweep } from "../src/ui/api/types";
import { I18nProvider, createI18n } from "../src/ui/i18n";
import { keyMap } from "../src/ui/queue/keys";
import { buildQueue, EMPTY_SESSION, pin } from "../src/ui/queue/order";
import { NOW, item, studio, thread, view } from "./fixtures/desk";

const sweep: MailSweep = { id: "news", kind: "sweep", target: "archive", label: "Newsletters", title: "Weekly news", why: "Unread.", mails: [{ key: "m1", from: "News", subject: "Issue" }] };
const task = { task: { id: "todo", title: "Write the report" }, areaTitle: "Work" };
const ended = { key: "ended", kind: "meeting" as const, title: "Board call", at: NOW - 60 * 60_000, end: NOW - 5 * 60_000 };
const desk = view({
  items: [item({ key: "soon", kind: "meeting" }), item({ key: "agent", kind: "decision" }), item({ key: "mail", kind: "mail" }), item({ key: "item", kind: "sensor" })],
  today: [ended], mailSweeps: [sweep], myDay: { items: [task] },
});

const render = (data: DeskView, key?: string, locale: "en" | "de" = "en") => renderToStaticMarkup(
  <I18nProvider value={createI18n(locale)}>
    <DayView client={createClient(async () => new Response("{}"))} state={{ view: data, studio: null, error: null, refresh: () => {} }} session={key ? pin(EMPTY_SESSION, key) : EMPTY_SESSION} setSession={() => {}} now={NOW} />
  </I18nProvider>,
);

describe("front card key map", () => {
  const queue = buildQueue(desk, studio(thread("waiting", "open", false)), EMPTY_SESSION, NOW);

  test("Enter completes a task and lets a sweep go with the same Desk requests as their buttons", () => {
    expect(keyMap(queue.find((e) => e.type === "task"))?.enter).toEqual({ label: "card.task.done", path: "/api/desk/my-day", body: { op: "done", id: "todo" } });
    expect(keyMap(queue.find((e) => e.type === "sweep"))?.enter).toEqual({ label: "card.sweep.letGo", path: "/api/desk/mail", body: { action: "sweep", sweep: "news", keys: ["m1"], target: "archive" } });
  });

  test("all other cards have no Enter act; Esc skips except for after-meeting dismissal", () => {
    expect(queue.map((e) => e.type).sort()).toEqual(["after", "agent", "item", "mail", "soon", "sweep", "task", "thread"]);
    for (const entry of queue) {
      const keys = keyMap(entry);
      if (entry.type !== "task" && entry.type !== "sweep") expect(keys?.enter).toBeNull();
      expect(keys?.esc).toEqual(entry.type === "after" ? { kind: "dismiss", label: "meeting.after.nothing" } : { kind: "skip", label: "queue.skip" });
    }
    expect(keyMap(undefined)).toBeNull();
  });
});

describe("key hints under the front card", () => {
  test("names task, sweep and after-meeting acts from the catalog", () => {
    const taskHtml = render(desk, "d:todo");
    expect(taskHtml).toContain('<div class="keyhint"><span><kbd>Enter</kbd> Done</span><span><kbd>Esc</kbd> Not now</span></div>');
    expect(taskHtml.indexOf('class="keyhint"')).toBeGreaterThan(taskHtml.indexOf("Write the report"));
    expect(render(desk, "s:news")).toContain("<kbd>Enter</kbd> Let all go");
    expect(render(desk, "a:ended")).toContain('<div class="keyhint"><span><kbd>Esc</kbd> Nothing to note</span></div>');
    expect(render(desk, "d:todo", "de")).toContain("<kbd>Enter</kbd> Erledigt");
  });

  test("mail has only Esc, and an empty queue has no hint", () => {
    expect(render(desk, "i:mail")).toContain('<div class="keyhint"><span><kbd>Esc</kbd> Not now</span></div>');
    expect(render(view())).not.toContain('class="keyhint"');
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "../src/ui/api/client";
import type { DeskItem, DeskInterrupt } from "../src/ui/api/types";
import { QueueContext } from "../src/ui/cards/act";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { buildQueue, EMPTY_SESSION, pin } from "../src/ui/queue/order";
import { QueueBody } from "../src/ui/queue/queue-view";
import { item, NOW, studio, thread, view } from "./fixtures/desk";
import { mountDom, type MountedDom } from "./fixtures/dom";

const interrupt = (key: string, overrides: Partial<DeskInterrupt> = {}, extras: Partial<DeskItem> = {}) => item({
  key, kind: "mail", score: 0, interrupt: { delivery: "pending", reason: { code: "mail.vip", target: "ada@example.org" }, ...overrides }, ...extras,
});

const queueKeys = (items: DeskItem[], session = EMPTY_SESSION) => buildQueue(view({ items }), studio(thread("topic", "open", false)), session, NOW).map(e => e.k);

describe("Cortex interruption priority", () => {
  const normal = item({ key: "normal", kind: "agent-blocked", score: 999 });
  test("interruptions of every item kind precede ordinary cards in Cortex order, regardless of score", () => {
    const urgent = [interrupt("mail"), interrupt("reminder", {}, { kind: "reminder", score: 100 }), interrupt("meeting", {}, { kind: "meeting", score: 500 })];
    expect(queueKeys([normal, ...urgent])).toEqual(["i:mail", "i:reminder", "i:meeting", "i:normal", "t:topic"]);
    expect(queueKeys([normal, ...urgent], { skip: ["i:mail"], pin: "i:normal" }).slice(0, 3)).toEqual(["i:mail", "i:reminder", "i:meeting"]);
  });
  test("held and reasonless markers keep their ordinary place; release promotes them", () => {
    const held = interrupt("held", { delivery: "held" });
    expect(queueKeys([held, normal])).toEqual(["i:normal", "i:held", "t:topic"]);
    expect(queueKeys([interrupt("legacy", { delivery: "failed", reason: undefined }), normal])[0]).toBe("i:normal");
    expect(queueKeys([{ ...held, interrupt: { ...held.interrupt!, delivery: "off" } }, normal])[0]).toBe("i:held");
  });
  test("an explicit selection can show another interrupting card ahead of its urgent peers", () => {
    expect(queueKeys([interrupt("first"), interrupt("clicked")], pin(EMPTY_SESSION, "i:clicked")).slice(0, 2)).toEqual(["i:clicked", "i:first"]);
  });
});

const noopClient = createClient(async () => Response.json({}));
function card(items: DeskItem[], locale: "en" | "de" = "en", client = noopClient, refresh = () => {}, session = EMPTY_SESSION) {
  return <I18nProvider value={createI18n(locale)}>
    <QueueContext.Provider value={{ client, refresh }}>
      <QueueBody state={{ view: view({ items }), studio: null, error: null }} session={session} setSession={() => {}} now={NOW} />
    </QueueContext.Provider>
  </I18nProvider>;
}

describe("interruption Why now", () => {
  const reasons = [
    ["meeting.soon", "A meeting is about to start.", "Ein Termin beginnt gleich."],
    ["reminder.due", "A reminder is due.", "Eine Erinnerung ist fällig."],
    ["mail.meeting-today", "Mail about a meeting today.", "Mail zu einem heutigen Termin."],
    ["mail.deadline-today", "Mail with a deadline today.", "Mail mit einer Frist für heute."],
    ["mail.vip", "Mail from VIP ada@example.org.", "Mail von VIP ada@example.org."],
    ["mail.ranked", "Mail ranked for today.", "Mail mit Vorrang für heute."],
  ];
  for (const [code, en, de] of reasons) test(`names ${code} in English and German and preserves Cortex why`, () => {
    const urgent = interrupt("urgent", { reason: { code: code!, target: "ada@example.org" } }, { why: "I waited until your meeting ended." });
    for (const [locale, expected] of [["en", en], ["de", de]] as const) {
      const html = renderToStaticMarkup(card([urgent], locale));
      expect(html).toContain(expected!);
      expect(html).toContain("I waited until your meeting ended.");
    }
  });
  test.each(["future.reason", "toString"])("unknown reason %s uses Cortex's why without inventing a label", code => {
    const html = renderToStaticMarkup(card([interrupt("unknown", { reason: { code } }, { why: "A new reason from Cortex." })]));
    expect(html).toContain("<b>Why now:</b> A new reason from Cortex.");
    expect(html).not.toContain(code);
  });
  test.each(["future.reason", "toString"])("unknown reason %s without why omits the Why now label", code => {
    for (const locale of ["en", "de"] as const) {
      const html = renderToStaticMarkup(card([interrupt("unknown", { reason: { code } }, { why: "" })], locale));
      expect(html).not.toContain(createI18n(locale).t("queue.why"));
      expect(html).toContain(createI18n(locale).t("interrupt.question"));
    }
  });
  test("a known reason still shows its label without Cortex why", () => {
    for (const [locale, expected] of [["en", "A reminder is due."], ["de", "Eine Erinnerung ist fällig."]] as const) {
      const html = renderToStaticMarkup(card([interrupt("due", { reason: { code: "reminder.due" } }, { why: "" })], locale));
      expect(html).toContain(`<b>${createI18n(locale).t("queue.why")}</b> ${expected}`);
    }
  });
  test("a held card shows the waiting text and does not ask for feedback yet", () => {
    const html = renderToStaticMarkup(card([interrupt("held", { delivery: "held" }, { why: "Waiting until the meeting ends." })]));
    expect(html).toContain("Waiting until the meeting ends.");
    expect(html).not.toContain("Was that important enough?");
  });
});

describe("interruption feedback on the rendered card", () => {
  let dom: MountedDom;
  let writes: { path: string; body: unknown }[];
  let refreshed: number;
  let response: () => Response;
  const client = createClient(async (path, init) => {
    writes.push({ path, body: JSON.parse(String(init?.body)) });
    return response();
  });
  beforeEach(() => {
    dom = mountDom(); writes = []; refreshed = 0; response = () => Response.json({ ok: true });
  });
  afterEach(async () => { await dom.cleanup(); });
  const mount = (items: DeskItem[], locale: "en" | "de" = "en", session = EMPTY_SESSION) => act(async () => {
    dom.root.render(card(items, locale, client, () => { refreshed++; }, session));
  });
  const click = (label: string) => act(async () => {
    Array.from(dom.container.querySelectorAll(".card button")).find(b => b.textContent === label)!.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  for (const important of [true, false]) test(`${important ? "Yes" : "No"} posts the item's reason and removes the question`, async () => {
    await mount([interrupt("vip")]);
    expect(dom.container.querySelector(".card")?.textContent).toContain("Was that important enough?");
    await click(important ? "Yes" : "No");
    expect(writes).toEqual([{ path: "/api/desk/interruptions/feedback", body: { key: "vip", code: "mail.vip", target: "ada@example.org", important } }]);
    expect(refreshed).toBe(1);
    expect(dom.container.textContent).not.toContain("Was that important enough?");
    if (!important) {
      const status = dom.container.querySelector('.card [role="status"]');
      expect(status?.textContent).toBe("This reason will no longer interrupt you.");
      expect(status?.querySelector("button")).toBeNull();
    }
    // A pending poll must not make the question reappear after leaving and returning.
    await mount([item({ key: "other", kind: "sensor" })]);
    await mount([interrupt("vip")]);
    expect(dom.container.textContent).not.toContain("Was that important enough?");
  });
  test("without a target, sends only key, code and important, and uses German controls", async () => {
    await mount([interrupt("due", { reason: { code: "reminder.due", dueAt: "today" } }, { kind: "reminder" })], "de");
    expect(dom.container.textContent).toContain("War das wichtig genug?");
    await click("Nein");
    expect(writes[0]?.body).toEqual({ key: "due", code: "reminder.due", important: false });
    expect(dom.container.textContent).toContain("Dieser Grund wird dich nicht mehr unterbrechen.");
  });
  test("Cortex refusal stays verbatim on the card and permits retry", async () => {
    response = () => Response.json({ error: "That address is not a VIP." }, { status: 404 });
    await mount([interrupt("vip")]);
    await click("No");
    expect(dom.container.querySelector('.card [role="alert"]')?.textContent).toBe("That address is not a VIP.");
    expect(dom.container.textContent).toContain("Was that important enough?");
    expect(refreshed).toBe(0);
    response = () => Response.json({ ok: true });
    await click("Yes");
    expect(writes).toHaveLength(2);
    expect(dom.container.querySelector('[role="alert"]')).toBeNull();
    expect(dom.container.textContent).not.toContain("Was that important enough?");
  });
  test("does not ask for feedback Cortex already has", async () => {
    await mount([interrupt("yes", { feedback: "yes" })]);
    expect(dom.container.textContent).not.toContain("Was that important enough?");
    await mount([interrupt("no", { feedback: "no" })]);
    expect(dom.container.textContent).not.toContain("Was that important enough?");
    expect(dom.container.textContent).toContain("This reason will no longer interrupt you.");
    expect(writes).toHaveLength(0);
  });
});

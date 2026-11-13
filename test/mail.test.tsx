import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "../src/ui/api/client";
import type { MailSweep } from "../src/ui/api/types";
import { QueueContext } from "../src/ui/cards/act";
import { latestUndoable, MailCard, SweepCard } from "../src/ui/cards/mail-cards";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { buildQueue, EMPTY_SESSION } from "../src/ui/queue/order";
import { item, NOW, view } from "./fixtures/desk";

const wrap = (node: React.ReactNode, locale: "en" | "de" = "en") =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <QueueContext.Provider value={{ client: createClient(async () => new Response("{}")), refresh: () => {} }}>{node}</QueueContext.Provider>
    </I18nProvider>,
  );

const sweep: MailSweep = {
  id: "sw1",
  kind: "sweep",
  target: "archive",
  label: "Newsletters",
  title: "Four newsletters from this week",
  why: "You let mail like this go before.",
  mails: [
    { key: "m1", from: "News A", subject: "Issue 1" },
    { key: "m2", from: "News B", subject: "Issue 2" },
  ],
};

describe("mail in the queue", () => {
  test("mail comes after waiting agents and before other items, sweeps first", () => {
    const queue = buildQueue(
      view({
        items: [item({ key: "other", kind: "sensor", score: 9 }), item({ key: "m", kind: "mail" }), item({ key: "a", kind: "decision" })],
        mailSweeps: [sweep],
      }),
      null,
      EMPTY_SESSION,
      NOW,
    );
    expect(queue.map((e) => e.k)).toEqual(["i:a", "s:sw1", "i:m", "i:other"]);
  });

  test("a mail card shows sender line, excerpt, why and its actions", () => {
    const html = wrap(
      <MailCard
        item={item({
          key: "m",
          kind: "mail",
          title: 'Ada wrote: "Budget"',
          excerpt: "Can we talk about the budget?",
          why: "It arrived today.",
          todoFingerprint: "a".repeat(64),
          detail: { summary: "", links: [{ label: "Open", url: "message:%3Cid%3E" }] },
        })}
      />,
    );
    for (const text of ['Ada wrote: "Budget"', "Can we talk about the budget?", "It arrived today.", "Let go", "Attach", "Draft a reply", "Ask me", "Open in Mail"]) {
      expect(html).toContain(text.replaceAll('"', "&quot;"));
    }
  });

  test("keep as a task is offered only with a fingerprint, and a suspicious mail is marked", () => {
    const html = wrap(<MailCard item={item({ key: "m", kind: "mail", suspicious: true })} initialPanel="ask" />);
    expect(html).not.toContain("Keep as a task");
    expect(html).toContain("Looks suspicious");
  });

  test("a sweep card asks to let the group go, in German too", () => {
    expect(wrap(<SweepCard sweep={sweep} />)).toContain("Let all 2 go?");
    expect(wrap(<SweepCard sweep={sweep} />, "de")).toContain("Alle 2 weglegen?");
  });
});

describe("undo", () => {
  const done = [
    { key: "mail-move:1", action: "mail.move", undo: "1", title: "Archived", message: "Archived “Budget”", at: NOW - 60_000, ok: true },
    { key: "mail-sweep:2", action: "mail.sweep", undo: "2", title: "Swept", message: "Moved 4 mails", at: NOW - 30_000, ok: true },
    { key: "capture:3", action: "capture", undo: "3", title: "Note", message: "Noted", at: NOW - 10_000, ok: true },
  ];

  test("offers the newest mail move or sweep within ten minutes", () => {
    expect(latestUndoable(done, NOW)?.key).toBe("mail-sweep:2");
    expect(latestUndoable(done, NOW + 11 * 60_000)).toBeNull();
  });
});

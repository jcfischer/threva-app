import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, type ReactNode } from "react";
import { createClient } from "../src/ui/api/client";
import type { DeskAction, DeskItem } from "../src/ui/api/types";
import { QueueContext } from "../src/ui/cards/act";
import { MailCard, SweepCard, UndoLine } from "../src/ui/cards/mail-cards";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { EntryCard } from "../src/ui/queue/queue-view";
import { item, NOW, sweep } from "./fixtures/desk";
import { mountDom, type MountedDom } from "./fixtures/dom";

const action = (id: string, label: string, wired = true): DeskAction => ({ id, label, role: "secondary", wired });

const mail = (actions: DeskAction[], overrides: Partial<DeskItem> = {}): DeskItem =>
  item({ key: "mail:1", kind: "mail", actions, detail: { summary: "", links: [{ label: "Open", url: "message:%3Cid%3E" }] }, ...overrides });

let dom: MountedDom;
let writes: unknown[];
let reply: (body: Record<string, unknown>) => Response;

beforeEach(() => {
  dom = mountDom();
  writes = [];
  reply = () => Response.json({ ok: true });
});
afterEach(async () => {
  await dom.cleanup();
});

async function mount(node: ReactNode, locale: "en" | "de" = "en") {
  const client = createClient(async (_url, init) => {
    const body = JSON.parse(init!.body as string) as Record<string, unknown>;
    writes.push(body);
    return reply(body);
  });
  await act(async () => {
    dom.root.render(
      <I18nProvider value={createI18n(locale)}>
        <QueueContext.Provider value={{ client, refresh: () => {} }}>{node}</QueueContext.Provider>
      </I18nProvider>,
    );
  });
}

const buttons = () => Array.from(dom.container.querySelectorAll("button")).map((b) => b.textContent);
const button = (text: string) => Array.from(dom.container.querySelectorAll("button")).find((b) => b.textContent === text)!;
const click = (text: string) => act(async () => { button(text).click(); });

describe("the archive outcome", () => {
  test("is called Archive, and Archivieren in German, and moves the mail to the archive", async () => {
    await mount(<MailCard item={mail([])} />);
    expect(buttons()).toContain("Archive");
    expect(buttons()).not.toContain("Let go");
    await click("Archive");
    expect(writes).toEqual([{ action: "move", key: "mail:1", target: "archive" }]);

    await mount(<MailCard item={mail([])} />, "de");
    expect(buttons()).toContain("Archivieren");
  });

  test("a sweep that archives says Archive all; a sweep to Trash keeps its wording", async () => {
    await mount(<SweepCard sweep={sweep({ mails: [{ key: "m1", from: "A", subject: "S" }] })} />);
    expect(buttons()).toEqual(["Archive all"]);
    await mount(<SweepCard sweep={sweep({ mails: [{ key: "m1", from: "A", subject: "S" }] })} />, "de");
    expect(buttons()).toEqual(["Alle archivieren"]);
    await mount(<SweepCard sweep={sweep({ target: "trash", mails: [{ key: "m1", from: "A", subject: "S" }] })} />);
    expect(buttons()).toEqual(["Let all go"]);
  });
});

describe("the mail actions Cortex lists", () => {
  const listed = [action("mail.archive", "Archive"), action("mail.spam", "Spam"), action("mail.trash", "Delete"), action("invite.accept", "Accept"), action("invite.decline", "Decline")];

  test("appear as quiet buttons after Open in Mail, labelled from the catalog", async () => {
    await mount(<MailCard item={mail(listed)} />);
    const row = dom.container.querySelector('[role="group"]')!;
    const quiet = Array.from(row.querySelectorAll(".btn.quiet")).map((b) => b.textContent);
    expect(quiet).toEqual(["Open in Mail", "Spam", "Delete", "Accept", "Decline"]);

    await mount(<MailCard item={mail(listed)} />, "de");
    expect(buttons()).toEqual(expect.arrayContaining(["Spam", "Löschen", "Zusagen", "Absagen"]));
  });

  test("actions Cortex lists under more are found too", async () => {
    const it = mail([action("mail.archive", "Archive"), action("mail.trash", "Delete")], {
      more: [action("vip.add", "Always show mail from Vera"), action("mail.spam", "Spam"), action("mail.unimportant", "Unimportant"), action("mail.snooze", "Snooze")],
    });
    await mount(<MailCard item={it} />);
    expect(buttons()).toEqual(["Archive", "Attach", "Draft a reply", "Ask me", "Spam", "Delete"]);
    await click("Spam");
    expect(writes).toEqual([{ action: "move", key: "mail:1", target: "junk" }]);
  });

  test("unlisted and unwired actions are not shown", async () => {
    await mount(<MailCard item={mail([action("mail.spam", "Spam", false), action("invite.accept", "Accept")])} />);
    expect(buttons()).toEqual(["Archive", "Attach", "Draft a reply", "Ask me", "Accept"]);
  });

  test("Spam and Delete move the mail to Junk and Trash and show what Cortex answers", async () => {
    reply = (body) => Response.json({ ok: true, message: `Moved to ${String(body.target)}.`, undo: "m7" });
    await mount(<MailCard item={mail(listed)} />);
    await click("Spam");
    expect(dom.container.textContent).toContain("Moved to junk.");
    await click("Delete");
    expect(writes).toEqual([
      { action: "move", key: "mail:1", target: "junk" },
      { action: "move", key: "mail:1", target: "trash" },
    ]);
    expect(dom.container.textContent).toContain("Moved to trash.");
  });

  test("a refused move shows Cortex's error on the card", async () => {
    reply = () => Response.json({ ok: false, error: "This mail is already in Junk." }, { status: 409 });
    await mount(<MailCard item={mail(listed)} />);
    await click("Spam");
    expect(dom.container.querySelector('[role="alert"]')?.textContent).toBe("This mail is already in Junk.");
  });

  test("a spam move lands in the same undo flow as an archive", async () => {
    const done = [{ key: "mail-move:m7", action: "mail.move", undo: "m7", title: "Moved to Junk", message: "Moved to Junk: “Budget”", at: NOW - 1000, ok: true }];
    await mount(<UndoLine done={done} now={NOW} />);
    expect(dom.container.textContent).toContain("Moved to Junk: “Budget”");
    await click("Undo");
    expect(writes).toEqual([{ action: "undo", move: "m7" }]);
  });

  test("an invitation answer is sent only after a second click, once per request id", async () => {
    reply = () => Response.json({ ok: false, error: "The reply command timed out." }, { status: 504 });
    await mount(<MailCard item={mail(listed)} />);
    await click("Accept");
    expect(writes).toEqual([]);
    expect(dom.container.textContent).toContain("This sends your answer to the organizer.");
    await click("Send the acceptance");
    expect(dom.container.querySelector('[role="alert"]')?.textContent).toBe("The reply command timed out.");
    reply = () => Response.json({ ok: true, message: "Accepted. The event is in your calendar." });
    await click("Send the acceptance");
    expect(dom.container.textContent).toContain("Accepted. The event is in your calendar.");
    expect(dom.container.textContent).not.toContain("This sends your answer");
    const [first, second] = writes as Record<string, unknown>[];
    expect(first).toEqual({ action: "invite.reply", key: "mail:1", reply: "accept", requestId: expect.stringMatching(/^[0-9a-f-]{36}$/), commitment: null, confirmed: true });
    expect(second).toEqual(first!);
  });

  test("declining can be cancelled before anything is sent", async () => {
    await mount(<MailCard item={mail(listed)} />, "de");
    await click("Absagen");
    expect(buttons()).toContain("Absage senden");
    await click("Abbrechen");
    expect(buttons()).not.toContain("Absage senden");
    expect(writes).toEqual([]);
  });
});

describe("a mail waiting for an answer", () => {
  const waiting = (actions: DeskAction[]): DeskItem =>
    item({ key: "waiting:<id>", kind: "mail-waiting", title: "Budget question to Ada", why: "3 working days without an answer.", actions });
  const entry = (it: DeskItem) => <EntryCard entry={{ k: `i:${it.key}`, type: "item", item: it, fresh: false }} onDismissMeeting={() => {}} />;

  test("offers the waiting actions Cortex lists and posts them", async () => {
    reply = () => Response.json({ ok: true, message: "The Desk stopped waiting for an answer." });
    const it = waiting([action("mail.draft", "Draft a nudge"), action("waiting.snooze", "Wait 2 more days"), action("waiting.done", "Done"), { ...action("open", "Open in Mail"), url: "message:%3Cid%3E" }]);
    await mount(entry(it));
    expect(buttons()).toEqual(["Wait longer", "Done"]);
    expect(dom.container.textContent).toContain("Open in Mail");
    await click("Wait longer");
    await click("Done");
    expect(writes).toEqual([{ action: "waiting.snooze", key: "waiting:<id>" }, { action: "waiting.done", key: "waiting:<id>" }]);
    expect(dom.container.textContent).toContain("The Desk stopped waiting for an answer.");

    await mount(entry(it), "de");
    expect(buttons()).toEqual(["Länger warten", "Erledigt"]);
  });

  test("leaves out waiting actions that are unlisted or unwired", async () => {
    await mount(entry({ ...waiting([action("waiting.snooze", "Wait 2 more days", false)]), more: [action("waiting.done", "Done", false)] }));
    expect(buttons()).toEqual([]);
  });
});

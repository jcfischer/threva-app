import { describe, expect, test } from "bun:test";
import type { DeskAction, DeskLink, MailSweep } from "@desk/types";
import { createI18n } from "../src/ui/i18n";
import { actionText, linkText, sweepText } from "../src/ui/i18n/served";

const en = createI18n("en");
const de = createI18n("de");

const link = (overrides: Partial<DeskLink> & Pick<DeskLink, "kind">): DeskLink => ({ url: "https://example.org/item", ...overrides });

const sweep = (overrides: Partial<MailSweep> & Pick<MailSweep, "kind" | "basis">): Pick<MailSweep, "kind" | "basis" | "labelPhrase"> => overrides;

const action = (overrides: Partial<DeskAction> & Pick<DeskAction, "id">): Pick<DeskAction, "id" | "labelPhrase" | "content"> => overrides;

describe("detail links", () => {
  test("are worded by their kind", () => {
    expect(linkText(link({ kind: "mail" }), en)).toBe("Open in Mail");
    expect(linkText(link({ kind: "issue" }), en)).toBe("Issue");
    expect(linkText(link({ kind: "report" }), en)).toBe("Raw report");
    expect(linkText(link({ kind: "source" }), en)).toBe("Open source");
    expect(linkText(link({ kind: "task" }), en)).toBe("Task");
    expect(linkText(link({ kind: "meeting" }), en)).toBe("Open");
    expect(linkText(link({ kind: "meeting-join" }), en)).toBe("Join");
  });

  test("an unsubscribe page names its address, so the link stays distinguishable", () => {
    expect(linkText(link({ kind: "unsubscribe-page", url: "https://lists.example.org/u/1" }), en)).toBe("Unsubscribe page: https://lists.example.org/u/1");
  });

  test("a kind from a later Desk API minor falls back to a plain open, as Cortex's own Desk does", () => {
    expect(linkText(link({ kind: "attachment" as DeskLink["kind"] }), en)).toBe("Open");
  });

  test("a task identifier comes from its label phrase", () => {
    expect(linkText(link({ kind: "task", labelPhrase: { code: "task.link", params: { id: "todo-7f3a" } } }), en)).toBe("Task todo-7f3a");
  });

  test("the German catalog words the same kinds", () => {
    expect(linkText(link({ kind: "mail" }), de)).toBe("In Mail öffnen");
    expect(linkText(link({ kind: "issue" }), de)).toBe("Issue");
    expect(linkText(link({ kind: "task", labelPhrase: { code: "task.link", params: { id: "todo-7f3a" } } }), de)).toBe("Aufgabe todo-7f3a");
  });
});

describe("mail groups", () => {
  test("are worded by what the mails have in common, by kind and basis", () => {
    expect(sweepText(sweep({ kind: "bundle", basis: "list" }), en)).toBe("same mailing list");
    expect(sweepText(sweep({ kind: "bundle", basis: "sender" }), en)).toBe("same sender");
    expect(sweepText(sweep({ kind: "bundle", basis: "similar" }), en)).toBe("similar content");
    expect(sweepText(sweep({ kind: "sweep", basis: "list" }), en)).toBe("mailing list");
    expect(sweepText(sweep({ kind: "sweep", basis: "sender" }), en)).toBe("sender");
    expect(sweepText(sweep({ kind: "sweep", basis: "age" }), en)).toBe("older mail");
    expect(sweepText(sweep({ kind: "digest", basis: "day" }), en)).toBe("newsletters");
  });

  test("a category comes from its label phrase, ahead of the kind", () => {
    expect(sweepText(sweep({ kind: "sweep", basis: "age", labelPhrase: { code: "mail.sweep-category", params: { category: "fyi" } } }), en)).toBe("fyi");
    expect(sweepText(sweep({ kind: "sweep", basis: "age", labelPhrase: { code: "mail.sweep-category", params: { category: "fyi" } } }), de)).toBe("fyi");
  });

  test("a basis this catalog does not carry has no wording rather than a made-up one", () => {
    expect(sweepText(sweep({ kind: "digest", basis: "sender" }), en)).toBe("");
  });

  test("a kind or basis from a later Desk API minor leaves a gap instead of throwing", () => {
    expect(sweepText({ kind: "thread" as MailSweep["kind"], basis: "list" }, en)).toBe("");
  });
});

describe("actions", () => {
  test("an adapter's own content is shown as it is", () => {
    expect(actionText(action({ id: "specimen.run", content: "Run the specimen" }), en)).toBe("Run the specimen");
  });

  test("a label phrase words the action", () => {
    expect(actionText(action({ id: "open", labelPhrase: { code: "ranger.ruling" } }), en)).toBe("Give your ruling");
    expect(actionText(action({ id: "open", labelPhrase: { code: "meeting.join" } }), en)).toBe("Join");
    expect(actionText(action({ id: "mail.draft", labelPhrase: { code: "waiting.nudge" } }), en)).toBe("Draft a nudge");
    expect(actionText(action({ id: "waiting.snooze", labelPhrase: { code: "waiting.snooze", params: { days: 2 } } }), en)).toBe("Wait 2 more days");
    expect(actionText(action({ id: "vip.add", labelPhrase: { code: "vip.add", params: {} } }), en)).toBe("Always show mail from this sender");
    expect(actionText(action({ id: "vip.add", labelPhrase: { code: "vip.add", params: { name: "Vera" } } }), de)).toBe("Mail von Vera immer zeigen");
  });

  test("the actions Threva shows have catalog wording", () => {
    expect(actionText(action({ id: "open" }), en)).toBe("Open");
    expect(actionText(action({ id: "detail" }), en)).toBe("Look first");
    expect(actionText(action({ id: "snooze" }), de)).toBe("Nicht jetzt");
  });

  test("an unknown action falls back to its code, as Cortex's own Desk does", () => {
    expect(actionText(action({ id: "ranger.mystery" }), en)).toBe("ranger.mystery");
  });
});

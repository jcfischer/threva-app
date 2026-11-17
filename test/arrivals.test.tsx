import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@desk/client";
import type { DeskAction, DeskItem } from "@desk/types";
import { isRuleOffer, requests } from "../src/ui/arrivals/outcomes";
import { QueueContext } from "../src/ui/cards/act";
import { MailCard, type MailCardProps, RuleOfferCard } from "../src/ui/cards/mail-cards";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { buildQueue, EMPTY_SESSION } from "../src/ui/queue/order";
import { item, NOW, view } from "./fixtures/desk";

const wrap = (node: React.ReactNode, locale: "en" | "de" = "en") =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <QueueContext.Provider value={{ client: createClient(async () => new Response("{}")), refresh: () => {} }}>{node}</QueueContext.Provider>
    </I18nProvider>,
  );

const act = (id: string, label: string, role: DeskAction["role"] = "secondary"): DeskAction => ({ id, label, role, wired: true });

// Mail items shaped the way Cortex's rank.ts composes them for each classifier outcome.
const mail = (key: string, overrides: Partial<DeskItem> = {}) =>
  item({ key: `mail:${key}`, kind: "mail", title: `Ada wrote: "${key}"`, attention: "action", actions: [act("open", "Open in Mail", "primary"), act("mail.snooze", "Snooze")], ...overrides });

const fixtures = {
  unclassified: mail("plain"),
  fyi: mail("fyi", { outcome: "archive", attention: "update", actions: [act("mail.seen", "Seen, delete", "primary"), act("open", "Open in Mail")] }),
  archive: mail("archive", { outcome: "archive", actions: [act("mail.archive", "Archive", "primary"), act("open", "Open in Mail")], suggestion: undefined }),
  meeting: mail("meeting", { eventKey: "ev1", outcome: "attach", actions: [act("meeting.show", "Show on the meeting", "primary"), act("open", "Open in Mail")] }),
  reply: mail("reply", { suggestion: "Suggested: reply", outcome: "draft", actions: [act("mail.draft", "Draft a reply", "primary"), act("open", "Open in Mail")] }),
  replyNotFirst: mail("reply2", { actions: [act("open", "Open in Mail", "primary"), act("mail.draft", "Draft a reply")] }),
};

const offer = item({
  key: "mailrule:sender:archive:news@example.com",
  kind: "mail-rule",
  title: "Archive mail from news@example.com on its own?",
  why: "You archived the last 3 and never did anything else with one. Nothing changes until you approve.",
  actions: [act("mailrule.approve", "Approve", "primary"), act("mailrule.later", "Not now"), act("mailrule.never", "Never")],
});
const held = item({ key: "mailrule:held:r1", kind: "mail-rule", actions: [act("mailrule.release", "Handle all 40", "primary"), act("mailrule.stop", "Stop this rule")] });

describe("learning phase", () => {
  const entries = (mailLearning?: boolean) =>
    buildQueue(view({ items: [fixtures.unclassified, fixtures.fyi], mailLearning }), null, EMPTY_SESSION, NOW).map((e) => (e.type === "mail" ? e.learning : null));

  test("follows the flag Cortex sends", () => {
    expect(entries(true)).toEqual([true, true]);
    expect(entries(false)).toEqual([false, false]);
  });

  test("an older Cortex without the flag shows no learning state", () => {
    expect(entries(undefined)).toEqual([false, false]);
  });

  test("the card says so in one line, and not otherwise", () => {
    expect(wrap(<MailCard item={fixtures.unclassified} learning />)).toContain("Learning phase: every mail comes to you until you approve a first rule.");
    expect(wrap(<MailCard item={fixtures.unclassified} learning />, "de")).toContain("Lernphase:");
    expect(wrap(<MailCard item={fixtures.unclassified} />)).not.toContain("Learning phase");
  });
});

describe("mail card", () => {
  const render = (props: MailCardProps, locale: "en" | "de" = "en") => wrap(<MailCard {...props} />, locale);

  test("shows the four outcomes with the suggested one marked", () => {
    const html = render({ item: fixtures.reply });
    for (const label of ["Archive", "Attach", "Draft a reply", "Ask me"]) expect(html).toContain(`>${label}</button>`);
    expect(html).toContain("Suggested: Draft a reply");
    expect(html).toContain('class="btn pri" aria-pressed="false">Draft a reply</button>');
    expect(render({ item: fixtures.fyi }, "de")).toContain("Vorschlag: Archivieren");
  });

  test("an unclassified mail has no suggested outcome", () => {
    const html = render({ item: fixtures.unclassified });
    expect(html).not.toContain("Suggested");
    expect(html).not.toContain("btn pri");
  });

  test("attach shows the proposed thread, or offers a new thread", () => {
    const proposed = render({
      item: fixtures.meeting,
      initialPanel: "attach",
      initialProposal: { thread: "budget-2027", reason: "It is about the budget.", threads: [{ slug: "budget-2027", question: "What goes into the 2027 budget?" }] },
    });
    expect(proposed).toContain("What goes into the 2027 budget?");
    expect(proposed).toContain("It is about the budget.");
    const none = render({ item: fixtures.meeting, initialPanel: "attach", initialProposal: { thread: null, reason: "No thread is active; it goes to the Studio inbox.", threads: [] } });
    expect(none).toContain("Start a new topic");
  });

  test("a proposed slug missing from the offered threads is labelled and sent as a new thread", () => {
    const stray = { thread: "gone", reason: "It fits.", threads: [{ slug: "other", question: "Something else?" }] };
    const html = render({ item: fixtures.meeting, initialPanel: "attach", initialProposal: stray });
    expect(html).toContain("Start a new topic");
    expect(html).not.toContain("Something else?");
  });

  test("draft opens the reply field and says nothing is sent", () => {
    const html = render({ item: fixtures.reply, initialPanel: "draft" });
    expect(html).toContain("<textarea");
    expect(html).toContain("Save draft");
    expect(html).toContain("Nothing is sent.");
  });

  test("ask offers snooze, and no longer a task, which sits with the outcomes", () => {
    const html = render({ item: { ...fixtures.unclassified, todoFingerprint: "a".repeat(64) }, initialPanel: "ask" });
    expect(html).not.toContain("Keep as a task");
    expect(html).toContain("Snooze");
  });
});

describe("write requests", () => {
  test("build the bodies this slice sends, as hand-copied from desk-mail.ts and desk-mail-rules.ts (not checked against Cortex)", () => {
    expect(requests.move("mail:1", "archive")).toEqual({ action: "move", key: "mail:1", target: "archive" });
    expect(requests.propose("mail:1")).toEqual({ action: "studio.propose", key: "mail:1" });
    expect(requests.draft("mail:1", "Thanks")).toEqual({ action: "draft", key: "mail:1", body: "Thanks" });
    expect(requests.snooze("mail:1", "tomorrow")).toEqual({ action: "snooze", key: "mail:1", until: { kind: "tomorrow" } });
    expect(requests.rule(offer.key, "never")).toEqual({ op: "never", proposal: offer.key });
  });
});

describe("rule offers", () => {
  test("a proposal becomes a rule-offer card after the mail; a paused rule does not", () => {
    expect(isRuleOffer(offer)).toBe(true);
    expect(isRuleOffer(held)).toBe(false);
    const queue = buildQueue(view({ items: [offer, held, fixtures.unclassified] }), null, EMPTY_SESSION, NOW);
    expect(queue.map((e) => `${e.type}:${e.k}`)).toEqual([`mail:i:${fixtures.unclassified.key}`, `rule:i:${offer.key}`, `item:i:${held.key}`]);
  });

  test("shows Cortex's sentence with Yes, Later and Never", () => {
    const html = wrap(<RuleOfferCard item={offer} />);
    for (const text of ["Archive mail from news@example.com on its own?", "Nothing changes until you approve.", ">Yes<", ">Later<", ">Never<"]) expect(html).toContain(text);
    expect(wrap(<RuleOfferCard item={offer} />, "de")).toContain("Ja, als Regel");
  });
});

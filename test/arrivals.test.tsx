import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "../src/ui/api/client";
import type { DeskAction, DeskItem, MailRule } from "../src/ui/api/types";
import { inLearningPhase, isRuleOffer, requests, suggestedOutcome } from "../src/ui/arrivals/outcomes";
import { QueueContext } from "../src/ui/cards/act";
import { MailCard, type MailCardProps, RuleOfferCard } from "../src/ui/cards/mail-cards";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { buildQueue, EMPTY_SESSION } from "../src/ui/queue/order";
import { loadDesk } from "../src/ui/queue/use-desk";
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
  fyi: mail("fyi", { attention: "update", actions: [act("mail.seen", "Seen, delete", "primary"), act("open", "Open in Mail")] }),
  archive: mail("archive", { actions: [act("mail.archive", "Archive", "primary"), act("open", "Open in Mail")], suggestion: undefined }),
  meeting: mail("meeting", { eventKey: "ev1", actions: [act("meeting.show", "Show on the meeting", "primary"), act("open", "Open in Mail")] }),
  reply: mail("reply", { suggestion: "Suggested: reply", actions: [act("mail.draft", "Draft a reply", "primary"), act("open", "Open in Mail")] }),
  replyNotFirst: mail("reply2", { actions: [act("open", "Open in Mail", "primary"), act("mail.draft", "Draft a reply")] }),
};

const rule: MailRule = { id: "r1", match: "sender", value: "news@example.com", action: "archive", on: true, sentence: "Archive mail from news@example.com" };

const offer = item({
  key: "mailrule:sender:archive:news@example.com",
  kind: "mail-rule",
  title: "Archive mail from news@example.com on its own?",
  why: "You archived the last 3 and never did anything else with one. Nothing changes until you approve.",
  actions: [act("mailrule.approve", "Approve", "primary"), act("mailrule.later", "Not now"), act("mailrule.never", "Never")],
});
const held = item({ key: "mailrule:held:r1", kind: "mail-rule", actions: [act("mailrule.release", "Handle all 40", "primary"), act("mailrule.stop", "Stop this rule")] });

describe("outcome mapping", () => {
  test("maps what Cortex sends to one of the four outcomes", () => {
    expect(suggestedOutcome(fixtures.fyi)).toBe("let-go");
    expect(suggestedOutcome(fixtures.archive)).toBe("let-go");
    expect(suggestedOutcome(fixtures.meeting)).toBe("attach");
    expect(suggestedOutcome(fixtures.reply)).toBe("draft");
  });

  test("a mail without classifier fields gets no suggestion", () => {
    expect(suggestedOutcome(fixtures.unclassified)).toBeNull();
    expect(suggestedOutcome(fixtures.replyNotFirst)).toBeNull();
  });
});

describe("learning phase", () => {
  test("lasts until a first approved rule", () => {
    expect(inLearningPhase(null)).toBe(true);
    expect(inLearningPhase([])).toBe(true);
    expect(inLearningPhase([rule])).toBe(false);
  });

  test("the poll reads the rules, and a refused read leaves none", async () => {
    const answer = (rules: Response) => async (input: string) => (input === "/api/desk/mail/rules" ? rules : Response.json(input === "/api/desk" ? view() : { studio: null }));
    const read = await loadDesk(createClient(answer(Response.json({ ok: true, rules: [rule] }))), { view: null, studio: null, error: null });
    expect(read.rules).toEqual([rule]);
    const refused = await loadDesk(createClient(answer(Response.json({ ok: false, error: "Mail rules need the move command." }, { status: 409 }))), read);
    expect(read.rules).toEqual([rule]);
    expect(refused.rules).toBeNull();
    expect(inLearningPhase(refused.rules)).toBe(true);
  });

  test("marks every mail entry while no rule exists", () => {
    const desk = view({ items: [fixtures.unclassified, fixtures.fyi] });
    const learning = buildQueue(desk, null, EMPTY_SESSION, NOW, [], []);
    expect(learning.map((e) => (e.type === "mail" ? e.learning : null))).toEqual([true, true]);
    const ruled = buildQueue(desk, null, EMPTY_SESSION, NOW, [], [rule]);
    expect(ruled.map((e) => (e.type === "mail" ? e.learning : null))).toEqual([false, false]);
  });

  test("the card says so in one line, and not after a rule", () => {
    expect(wrap(<MailCard item={fixtures.unclassified} learning />)).toContain("Learning phase: every mail comes to you until you approve a first rule.");
    expect(wrap(<MailCard item={fixtures.unclassified} learning />, "de")).toContain("Lernphase:");
    expect(wrap(<MailCard item={fixtures.unclassified} />)).not.toContain("Learning phase");
  });
});

describe("mail card", () => {
  const render = (props: MailCardProps, locale: "en" | "de" = "en") => wrap(<MailCard {...props} />, locale);

  test("shows the four outcomes with the suggested one marked", () => {
    const html = render({ item: fixtures.reply });
    for (const label of ["Let go", "Attach", "Draft a reply", "Ask me"]) expect(html).toContain(`>${label}</button>`);
    expect(html).toContain("Suggested: Draft a reply");
    expect(html).toContain('class="btn pri" aria-pressed="false">Draft a reply</button>');
    expect(render({ item: fixtures.fyi }, "de")).toContain("Vorschlag: Weglegen");
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
    expect(none).toContain("Start a new thread");
  });

  test("a proposed slug missing from the offered threads is labelled and sent as a new thread", () => {
    const stray = { thread: "gone", reason: "It fits.", threads: [{ slug: "other", question: "Something else?" }] };
    const html = render({ item: fixtures.meeting, initialPanel: "attach", initialProposal: stray });
    expect(html).toContain("Start a new thread");
    expect(html).not.toContain("Something else?");
    expect(requests.attach("mail:1", stray, "abcdefgh12")).toEqual({ action: "studio.add", key: "mail:1", requestId: "abcdefgh12", thread: null, includeText: false });
  });

  test("draft opens the reply field and says nothing is sent", () => {
    const html = render({ item: fixtures.reply, initialPanel: "draft" });
    expect(html).toContain("<textarea");
    expect(html).toContain("Save draft");
    expect(html).toContain("Nothing is sent.");
  });

  test("ask offers keep as a task and snooze", () => {
    const html = render({ item: { ...fixtures.unclassified, todoFingerprint: "a".repeat(64) }, initialPanel: "ask" });
    expect(html).toContain("Keep as a task");
    expect(html).toContain("Snooze");
  });
});

describe("write requests", () => {
  test("build the bodies this slice sends, as hand-copied from desk-mail.ts and desk-mail-rules.ts (not checked against Cortex)", () => {
    expect(requests.letGo("mail:1")).toEqual({ action: "move", key: "mail:1", target: "archive" });
    expect(requests.propose("mail:1")).toEqual({ action: "studio.propose", key: "mail:1" });
    expect(requests.attach("mail:1", { thread: "t", reason: " fits ", threads: [{ slug: "t", question: "T?" }] }, "abcdefgh12")).toEqual({
      action: "studio.add",
      key: "mail:1",
      requestId: "abcdefgh12",
      thread: "t",
      includeText: false,
      reason: "fits",
    });
    expect(requests.attach("mail:1", { thread: null, reason: "No thread is active.", threads: [] }, "abcdefgh12")).toEqual({
      action: "studio.add",
      key: "mail:1",
      requestId: "abcdefgh12",
      thread: null,
      includeText: false,
    });
    expect(requests.draft("mail:1", "Thanks")).toEqual({ action: "draft", key: "mail:1", body: "Thanks" });
    expect(requests.keep("mail:1", "f")).toEqual({ op: "todo", key: "mail:1", fingerprint: "f" });
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

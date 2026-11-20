import type { DeskPhrase } from "@the-metafactory/cortex/desk-api";
import type { DeskAction, DeskLink, MailSweep } from "@desk/types";
import type { I18n, TextKey } from "./index";

/** The English for one of Cortex's label phrases, or null for a code this catalog does not carry. */
export function phraseText(phrase: DeskPhrase, i18n: I18n): string | null {
  switch (phrase.code) {
    case "task.link": return i18n.t("phrase.taskLink", { id: phrase.params.id });
    case "mail.sweep-category": return i18n.t("phrase.sweepCategory", { category: phrase.params.category });
    case "mailrule.release": return i18n.t("phrase.mailruleRelease", { count: phrase.params.count });
    case "mail.assistant": return i18n.t("phrase.mailAssistant", { name: phrase.params.name });
    case "assistant.retry": return i18n.t("phrase.assistantRetry", { name: phrase.params.name });
    case "vip.add": return phrase.params.name === undefined ? i18n.t("phrase.vipAddSender") : i18n.t("phrase.vipAdd", { name: phrase.params.name });
    case "meeting.join": return i18n.t("phrase.meetingJoin");
    case "meeting.open": return i18n.t("phrase.meetingOpen");
    case "ranger.ruling": return i18n.t("phrase.rangerRuling");
    case "mail.junk-review": return i18n.t("phrase.mailJunkReview");
    case "goal.run-check": return i18n.t("phrase.goalRunCheck");
    case "waiting.nudge": return i18n.t("phrase.waitingNudge");
    case "waiting.snooze": return i18n.tn("phrase.waitingSnooze", phrase.params.days, { days: phrase.params.days });
    default: return null;
  }
}

const LINK_TEXT: Record<DeskLink["kind"], TextKey> = {
  mail: "link.mail",
  issue: "link.issue",
  report: "link.report",
  source: "link.source",
  "unsubscribe-page": "link.unsubscribePage",
  task: "link.task",
  meeting: "link.meeting",
  "meeting-join": "link.meetingJoin",
};

/** A detail link: its label phrase when Cortex sends one, else the wording of its kind. */
export function linkText(link: DeskLink, i18n: I18n): string {
  const phrase = link.labelPhrase ? phraseText(link.labelPhrase, i18n) : null;
  return phrase ?? i18n.t(LINK_TEXT[link.kind], { url: link.url });
}

const SWEEP_TEXT: Record<MailSweep["kind"], Partial<Record<MailSweep["basis"], TextKey>>> = {
  bundle: { list: "sweep.bundle.list", sender: "sweep.bundle.sender", similar: "sweep.bundle.similar" },
  sweep: { list: "sweep.sweep.list", sender: "sweep.sweep.sender", age: "sweep.sweep.age" },
  digest: { day: "sweep.digest.day" },
};

/** What a group of mail has in common: its category phrase when Cortex sends one, else its kind and basis. */
export function sweepText(sweep: Pick<MailSweep, "kind" | "basis" | "labelPhrase">, i18n: I18n): string {
  const phrase = sweep.labelPhrase ? phraseText(sweep.labelPhrase, i18n) : null;
  const key = SWEEP_TEXT[sweep.kind][sweep.basis];
  return phrase ?? (key === undefined ? "" : i18n.t(key));
}

const ACTION_TEXT: Partial<Record<string, TextKey>> = {
  open: "action.open",
  detail: "action.detail",
  snooze: "action.snooze",
  "mail.unsubscribe.page": "action.unsubscribePage",
  "ranger.rule": "card.agent.action.ranger.rule",
  "ranger.retry": "card.agent.action.ranger.retry",
  "ranger.approve": "card.agent.action.ranger.approve",
};

/** An action's wording: an adapter's own content, else its label phrase, else its code, else the code itself. */
export function actionText(action: Pick<DeskAction, "id" | "labelPhrase" | "content">, i18n: I18n): string {
  const phrase = action.labelPhrase ? phraseText(action.labelPhrase, i18n) : null;
  const key = Object.hasOwn(ACTION_TEXT, action.id) ? ACTION_TEXT[action.id] : undefined;
  return action.content ?? phrase ?? (key === undefined ? action.id : i18n.t(key));
}

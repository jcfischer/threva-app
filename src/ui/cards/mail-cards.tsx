import { safeHref } from "@desk/safe-link";
import { useState } from "react";
import { asUuid, type DeskClient } from "@desk/client";
import type { DeskItem, DoneEntry, MailSweep, StudioProposal } from "@desk/types";
import {
  MAIL_ACTION_DOES, MAIL_ACTIONS, OUTCOMES, proposedThread, requests, SNOOZE_TIMES, WAITING_ACTIONS, wiredActions,
  type InviteReply, type MailAction, type Outcome, type SnoozeTime, type WaitingAction,
} from "../arrivals/outcomes";
import { useI18n, type TextKey } from "../i18n";
import { sweepText } from "../i18n/served";
import { sweepEnter } from "../queue/keys";
import { useAct, useQueue } from "./act";
import { Card, ErrorLine, MakeTaskButton } from "./parts";

function mailLink(item: DeskItem): string | undefined {
  return item.detail.links.map((l) => safeHref(l.url)).find(Boolean) ?? item.actions.map((a) => safeHref(a.url)).find(Boolean);
}

function OpenInMail({ item }: { item: DeskItem }) {
  const { t } = useI18n();
  const link = mailLink(item);
  return link ? (
    <a className="btn quiet" href={link} target="_blank" rel="noreferrer">
      {t("card.mail.open")}
    </a>
  ) : null;
}

const noop = (): void => undefined;

type Card = ReturnType<typeof useAct>;

async function sendMail(card: Card, client: DeskClient, body: Record<string, unknown>, show: (message: string) => void): Promise<boolean> {
  const result = await card.act<{ message?: string }>({ mail: body }, () => client.mail.send<{ message?: string }>(body));
  if (result.ok && result.data.message) show(result.data.message);
  return result.ok;
}

const OUTCOME_LABEL: Record<Outcome, TextKey> = {
  archive: "card.mail.archive",
  attach: "card.mail.attach",
  draft: "card.mail.draft",
  ask: "card.mail.ask",
};

const MAIL_ACTION_LABEL: Record<MailAction, TextKey> = {
  "mail.spam": "card.mail.spam",
  "mail.trash": "card.mail.trash",
  "invite.accept": "card.mail.invite.accept",
  "invite.decline": "card.mail.invite.decline",
};

const SEND_INVITE_LABEL: Record<InviteReply, TextKey> = { accept: "card.mail.invite.sendAccept", decline: "card.mail.invite.sendDecline" };

const SNOOZE_LABEL: Record<SnoozeTime, TextKey> = { later: "card.mail.snooze.later", tomorrow: "card.mail.snooze.tomorrow", "next-week": "card.mail.snooze.nextWeek" };

type Panel = "attach" | "draft" | "ask" | null;

interface InviteAsk {
  reply: InviteReply;
}

export interface MailCardProps {
  item: DeskItem;
  learning?: boolean;
  initialPanel?: Panel;
  initialProposal?: StudioProposal | null;
}

export function MailCard({ item, learning = false, initialPanel = null, initialProposal = null }: MailCardProps) {
  const { t } = useI18n();
  const card = useAct();
  const { client } = useQueue();
  const { busy, error } = card;
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [proposal, setProposal] = useState<StudioProposal | null>(initialProposal);
  const [snoozing, setSnoozing] = useState(false);
  const [body, setBody] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteAsk | null>(null);
  const suggested = item.outcome ?? null;
  const more = wiredActions(item, MAIL_ACTIONS);

  const choose = async (outcome: Outcome) => {
    setDone(null);
    setSnoozing(false);
    setInvite(null);
    if (outcome === "archive") {
      setPanel(null);
      await sendMail(card, client, requests.move(item.key, "archive"), noop);
      return;
    }
    setPanel(outcome);
    if (outcome === "attach") {
      setProposal(null);
      const body = requests.propose(item.key);
      const result = await card.act<{ proposal: StudioProposal }>({ mail: body }, () => client.mail.send<{ proposal: StudioProposal }>(body));
      if (result.ok) setProposal(result.data.proposal);
    }
  };
  const finish = (message: string | undefined, fallback: string) => {
    setDone(message || fallback);
    setPanel(null);
  };
  const attach = async () => {
    if (!proposal) return;
    const slug = proposedThread(proposal)?.slug ?? null;
    const reason = slug ? proposal.reason.trim() : "";
    const result = await card.act<{ message?: string }>({ attach: item.key, thread: slug, reason }, (requestId) => client.mail.studioAdd(item.key, slug, reason || undefined, requestId));
    if (result.ok) finish(result.data.message, t("card.mail.attached"));
  };
  const saveDraft = async () => {
    const request = requests.draft(item.key, body);
    const result = await card.act({ mail: request }, () => client.mail.send(request));
    if (result.ok) finish(undefined, t("card.mail.drafted"));
  };
  const snooze = async (kind: SnoozeTime) => {
    const request = requests.snooze(item.key, kind);
    const result = await card.act<{ message?: string }>({ mail: request }, () => client.mail.send<{ message?: string }>(request));
    if (result.ok) finish(result.data.message, t("card.mail.snoozed"));
  };
  const act = async (action: MailAction) => {
    setDone(null);
    setPanel(null);
    setSnoozing(false);
    const does = MAIL_ACTION_DOES[action];
    if ("invite" in does) {
      setInvite({ reply: does.invite });
      return;
    }
    setInvite(null);
    await sendMail(card, client, requests.move(item.key, does.move), setDone);
  };
  const sendInvite = async (ask: InviteAsk) => {
    const result = await card.act<{ message?: string }>({ invite: item.key, reply: ask.reply }, (requestId) => client.mail.inviteReply(item.key, ask.reply, asUuid(requestId)));
    if (result.ok) {
      if (result.data.message) setDone(result.data.message);
      setInvite(null);
    }
  };
  const thread = proposal ? proposedThread(proposal) : null;

  return (
    <Card eyebrow={t("card.mail.eyebrow")} pill={item.suspicious ? <span className="pill wait">{t("card.mail.suspicious")}</span> : undefined}>
      <span className="q">{item.title}</span>
      {(item.excerpt || item.detail.summary) && <span className="sub">{item.excerpt || item.detail.summary}</span>}
      <span className="faint">{item.why}</span>
      {item.suspicious && item.detail.suspicion?.map((s) => <span key={s} className="faint">{s}</span>)}
      {learning && <span className="faint">{t("card.mail.learning")}</span>}
      {suggested && <span className="faint">{t("card.mail.suggested", { outcome: t(OUTCOME_LABEL[suggested]) })}</span>}
      <div className="row" role="group" aria-label={t("card.mail.outcomes")}>
        {OUTCOMES.map((outcome) => (
          <button
            key={outcome}
            type="button"
            className={outcome === suggested ? "btn pri" : "btn"}
            aria-pressed={panel === outcome}
            disabled={busy}
            onClick={() => void choose(outcome)}
          >
            {t(OUTCOME_LABEL[outcome])}
          </button>
        ))}
        <MakeTaskButton item={item} act={card} />
        <OpenInMail item={item} />
        {more.map((action) => (
          <button key={action} type="button" className="btn quiet" disabled={busy} onClick={() => void act(action)}>
            {t(MAIL_ACTION_LABEL[action])}
          </button>
        ))}
      </div>
      {invite && (
        <div className="row">
          <span className="faint">{t("card.mail.invite.confirm")}</span>
          <button type="button" className="btn pri" disabled={busy} onClick={() => void sendInvite(invite)}>
            {t(SEND_INVITE_LABEL[invite.reply])}
          </button>
          <button type="button" className="btn quiet" onClick={() => setInvite(null)}>
            {t("card.mail.cancel")}
          </button>
        </div>
      )}
      {panel === "attach" && (
        <div className="ivy">
          {!proposal ? (
            busy ? <span className="faint">{t("card.mail.attach.looking")}</span> : (
              <button type="button" className="btn quiet" onClick={() => setPanel(null)}>
                {t("card.mail.cancel")}
              </button>
            )
          ) : (
            <>
              <span className="from">{thread ? t("card.mail.attach.to") : t("card.mail.attach.none")}</span>
              {thread && <p><b>{thread.question}</b></p>}
              {proposal.reason && <span className="faint">{proposal.reason}</span>}
              <div className="row">
                <button type="button" className="btn pri" disabled={busy} onClick={() => void attach()}>
                  {thread ? t("card.mail.attach.confirm") : t("card.mail.attach.newThread")}
                </button>
                <button type="button" className="btn quiet" onClick={() => setPanel(null)}>
                  {t("card.mail.cancel")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {panel === "draft" && (
        <>
          <textarea aria-label={t("card.mail.reply")} placeholder={t("card.mail.reply")} value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          <span className="faint">{t("card.mail.notSent")}</span>
          <div className="row">
            <button type="button" className="btn pri" disabled={busy || !body.trim()} onClick={() => void saveDraft()}>
              {t("card.mail.saveDraft")}
            </button>
            <button type="button" className="btn quiet" onClick={() => setPanel(null)}>
              {t("card.mail.cancel")}
            </button>
          </div>
        </>
      )}
      {panel === "ask" && (
        <div className="row">
          {snoozing ? (
            SNOOZE_TIMES.map((kind) => (
              <button key={kind} type="button" className="btn" disabled={busy} onClick={() => void snooze(kind)}>
                {t(SNOOZE_LABEL[kind])}
              </button>
            ))
          ) : (
            <button type="button" className="btn" disabled={busy} onClick={() => setSnoozing(true)}>
              {t("card.mail.snooze")}
            </button>
          )}
          <button type="button" className="btn quiet" onClick={() => setPanel(null)}>
            {t("card.mail.cancel")}
          </button>
        </div>
      )}
      {done && <span className="faint">{done}</span>}
      <ErrorLine error={error} />
    </Card>
  );
}

export function RuleOfferCard({ item }: { item: DeskItem }) {
  const { t } = useI18n();
  const card = useAct();
  const { client } = useQueue();
  const { busy, error } = card;
  const answer = (op: "approve" | "later" | "never") => card.act({ rule: item.key, op }, () => client.mail.rule(item.key, op));
  return (
    <Card eyebrow={t("card.rule.eyebrow")}>
      <span className="q">{item.title}</span>
      <span className="sub">{item.why}</span>
      {item.detail.summary && <span className="faint">{item.detail.summary}</span>}
      <div className="row">
        <button type="button" className="btn pri" disabled={busy} onClick={() => void answer("approve")}>
          {t("card.rule.yes")}
        </button>
        <MakeTaskButton item={item} act={card} />
        <button type="button" className="btn" disabled={busy} onClick={() => void answer("later")}>
          {t("card.rule.later")}
        </button>
        <button type="button" className="btn quiet" disabled={busy} onClick={() => void answer("never")}>
          {t("card.rule.never")}
        </button>
      </div>
      <ErrorLine error={error} />
    </Card>
  );
}

export function SweepCard({ sweep }: { sweep: MailSweep }) {
  const i18n = useI18n();
  const { t, tn } = i18n;
  const enter = sweepEnter(sweep);
  const { busy, error, perform } = useAct(enter);
  return (
    <Card eyebrow={t("card.sweep.eyebrow")}>
      <span className="q">{tn(sweep.target === "archive" ? "card.sweep.archiveQuestion" : "card.sweep.question", sweep.mails.length)}</span>
      <span className="sub">{sweep.title || sweepText(sweep, i18n)}</span>
      <span className="faint">{sweep.why}</span>
      <ul className="plain">
        {sweep.mails.slice(0, 5).map((m) => (
          <li key={m.key} className="faint">
            {m.from}: {m.subject}
          </li>
        ))}
      </ul>
      {sweep.mails.length > 5 && <span className="faint">{tn("card.sweep.more", sweep.mails.length - 5)}</span>}
      <div className="row">
        <button type="button" className="btn pri" disabled={busy} onClick={perform}>
          {t(enter.label)}
        </button>
      </div>
      <ErrorLine error={error} />
    </Card>
  );
}

const WAITING_LABEL: Record<WaitingAction, TextKey> = { "waiting.snooze": "card.waiting.snooze", "waiting.done": "card.waiting.done" };

export function WaitingCard({ item, fresh = false }: { item: DeskItem; fresh?: boolean }) {
  const { t } = useI18n();
  const card = useAct();
  const { client } = useQueue();
  const { busy, error } = card;
  const [done, setDone] = useState<string | null>(null);
  const answer = async (action: WaitingAction) => {
    setDone(null);
    await sendMail(card, client, requests.waiting(item.key, action), setDone);
  };
  return (
    <Card eyebrow={t("card.mail.eyebrow")} pill={fresh ? <span className="pill think">{t("card.item.new")}</span> : undefined}>
      <span className="q">{item.title}</span>
      <span className="sub">{item.why}</span>
      <div className="row">
        {wiredActions(item, WAITING_ACTIONS).map((action) => (
          <button key={action} type="button" className="btn" disabled={busy} onClick={() => void answer(action)}>
            {t(WAITING_LABEL[action])}
          </button>
        ))}
        <MakeTaskButton item={item} act={card} />
        <OpenInMail item={item} />
      </div>
      {done && <span className="faint">{done}</span>}
      <ErrorLine error={error} />
    </Card>
  );
}

const UNDO_BY: Record<string, (id: string) => Record<string, string>> = {
  "mail.move": (id) => ({ action: "undo", move: id }),
  "mail.sweep": (id) => ({ action: "sweep.undo", sweep: id }),
};

export const UNDO_WINDOW_MS = 10 * 60 * 1000;

export function latestUndoable(done: readonly DoneEntry[], now: number): DoneEntry | null {
  const candidates = done.filter((d) => d.ok && d.undo && d.action && UNDO_BY[d.action] && now - d.at < UNDO_WINDOW_MS);
  return candidates.reduce<DoneEntry | null>((best, d) => (!best || d.at > best.at ? d : best), null);
}

export function UndoLine({ done, now }: { done: readonly DoneEntry[]; now: number }) {
  const { t } = useI18n();
  const card = useAct();
  const { client } = useQueue();
  const { busy, error } = card;
  const entry = latestUndoable(done, now);
  if (!entry?.action || !entry.undo) return null;
  const body = UNDO_BY[entry.action]?.(entry.undo);
  if (!body) return null;
  return (
    <div className="toast row">
      <span>{entry.message || entry.title}</span>
      <button type="button" className="lk" disabled={busy} onClick={() => void card.act({ mail: body }, () => client.mail.send(body))}>
        {t("undo")}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

import { safeHref } from "../api/safe-link";
import { useRef, useState } from "react";
import { newRequestId } from "../api/client";
import type { DeskItem, DoneEntry, MailSweep, StudioProposal } from "../api/types";
import {
  MAIL_ACTION_DOES, MAIL_ACTIONS, OUTCOMES, proposedThread, requests, SNOOZE_TIMES, suggestedOutcome, WAITING_ACTIONS, wiredActions,
  type InviteReply, type MailAction, type Outcome, type SnoozeTime, type WaitingAction,
} from "../arrivals/outcomes";
import { useI18n, type TextKey } from "../i18n";
import { sweepEnter } from "../queue/keys";
import { useAct } from "./act";
import { Card, ErrorLine } from "./parts";

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

// Posts one mail action and shows the message Cortex answers with. Returns whether Cortex accepted it.
async function postMail(run: ReturnType<typeof useAct>["run"], body: unknown, show: (message: string) => void): Promise<boolean> {
  const result = await run<{ message?: string }>("/api/desk/mail", body);
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
  requestId: string;
}

export interface MailCardProps {
  item: DeskItem;
  learning?: boolean;
  initialPanel?: Panel;
  initialProposal?: StudioProposal | null;
}

export function MailCard({ item, learning = false, initialPanel = null, initialProposal = null }: MailCardProps) {
  const { t } = useI18n();
  const { busy, error, run } = useAct();
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [proposal, setProposal] = useState<StudioProposal | null>(initialProposal);
  const [snoozing, setSnoozing] = useState(false);
  const [body, setBody] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteAsk | null>(null);
  const suggested = suggestedOutcome(item);
  const more = wiredActions(item, MAIL_ACTIONS);

  const choose = async (outcome: Outcome) => {
    setDone(null);
    setSnoozing(false);
    setInvite(null);
    if (outcome === "archive") {
      setPanel(null);
      await run("/api/desk/mail", requests.move(item.key, "archive"));
      return;
    }
    setPanel(outcome);
    if (outcome === "attach") {
      setProposal(null);
      const result = await run<{ proposal: StudioProposal }>("/api/desk/mail", requests.propose(item.key));
      if (result.ok) setProposal(result.data.proposal);
    }
  };
  const finish = (message: string | undefined, fallback: string) => {
    setDone(message || fallback);
    setPanel(null);
  };
  const attach = async () => {
    if (!proposal) return;
    const result = await run<{ message?: string }>("/api/desk/mail", requests.attach(item.key, proposal, newRequestId()));
    if (result.ok) finish(result.data.message, t("card.mail.attached"));
  };
  const saveDraft = async () => {
    const result = await run("/api/desk/mail", requests.draft(item.key, body));
    if (result.ok) finish(undefined, t("card.mail.drafted"));
  };
  const keep = async (fingerprint: string) => {
    const result = await run<{ message?: string }>("/api/desk/my-day", requests.keep(item.key, fingerprint));
    if (result.ok) finish(result.data.message, t("card.mail.kept"));
  };
  const snooze = async (kind: SnoozeTime) => {
    const result = await run<{ message?: string }>("/api/desk/mail", requests.snooze(item.key, kind));
    if (result.ok) finish(result.data.message, t("card.mail.snoozed"));
  };
  // Spam and Delete move the mail at once: Cortex logs the move, so the undo line offers it back. An invitation
  // answer goes out only after a second, explicit click. Each answer keeps one request id for the card's life, also
  // across Cancel and a new click, so Cortex can refuse a second send after a timeout that may have delivered it.
  const inviteIds = useRef<Partial<Record<InviteReply, string>>>({});
  const act = async (action: MailAction) => {
    setDone(null);
    setPanel(null);
    setSnoozing(false);
    const does = MAIL_ACTION_DOES[action];
    if ("invite" in does) {
      const requestId = (inviteIds.current[does.invite] ??= crypto.randomUUID());
      setInvite({ reply: does.invite, requestId });
      return;
    }
    setInvite(null);
    await postMail(run, requests.move(item.key, does.move), setDone);
  };
  const sendInvite = async (ask: InviteAsk) => {
    if (await postMail(run, requests.inviteReply(item.key, ask.reply, ask.requestId), setDone)) setInvite(null);
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
          {item.todoFingerprint && (
            <button type="button" className="btn" disabled={busy} onClick={() => void keep(item.todoFingerprint ?? "")}>
              {t("card.mail.keep")}
            </button>
          )}
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
  const { busy, error, run } = useAct();
  const answer = (op: "approve" | "later" | "never") => run("/api/desk/mail/rules", requests.rule(item.key, op));
  return (
    <Card eyebrow={t("card.rule.eyebrow")}>
      <span className="q">{item.title}</span>
      <span className="sub">{item.why}</span>
      {item.detail.summary && <span className="faint">{item.detail.summary}</span>}
      <div className="row">
        <button type="button" className="btn pri" disabled={busy} onClick={() => void answer("approve")}>
          {t("card.rule.yes")}
        </button>
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
  const { t, tn } = useI18n();
  const enter = sweepEnter(sweep);
  const { busy, error, perform } = useAct(enter);
  return (
    <Card eyebrow={t("card.sweep.eyebrow")}>
      <span className="q">{tn("card.sweep.question", sweep.mails.length)}</span>
      <span className="sub">{sweep.title || sweep.label}</span>
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

// A sent mail that still waits for an answer. It offers the waiting actions Cortex lists and shows Cortex's answer.
export function WaitingCard({ item, fresh = false }: { item: DeskItem; fresh?: boolean }) {
  const { t } = useI18n();
  const { busy, error, run } = useAct();
  const [done, setDone] = useState<string | null>(null);
  const answer = async (action: WaitingAction) => {
    setDone(null);
    await postMail(run, requests.waiting(item.key, action), setDone);
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
  const { busy, error, run } = useAct();
  const entry = latestUndoable(done, now);
  if (!entry?.action || !entry.undo) return null;
  const body = UNDO_BY[entry.action]?.(entry.undo);
  if (!body) return null;
  return (
    <div className="toast row">
      <span>{entry.message || entry.title}</span>
      <button type="button" className="lk" disabled={busy} onClick={() => run("/api/desk/mail", body)}>
        {t("undo")}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

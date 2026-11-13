import { useState } from "react";
import { newRequestId } from "../api/client";
import type { DeskItem, DoneEntry, MailSweep, StudioProposal } from "../api/types";
import { OUTCOMES, requests, SNOOZE_TIMES, suggestedOutcome, type Outcome, type SnoozeTime } from "../arrivals/outcomes";
import { useI18n, type TextKey } from "../i18n";
import { useAct } from "./act";
import { Card, ErrorLine } from "./parts";

function mailLink(item: DeskItem): string | undefined {
  return item.detail.links.find((l) => /^(message|https?):/.test(l.url))?.url ?? item.actions.find((a) => a.url)?.url;
}

const OUTCOME_LABEL: Record<Outcome, TextKey> = {
  "let-go": "card.mail.letGo",
  attach: "card.mail.attach",
  draft: "card.mail.draft",
  ask: "card.mail.ask",
};

const SNOOZE_LABEL: Record<SnoozeTime, TextKey> = { later: "card.mail.snooze.later", tomorrow: "card.mail.snooze.tomorrow", "next-week": "card.mail.snooze.nextWeek" };

type Panel = "attach" | "draft" | "ask" | null;

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
  const link = mailLink(item);
  const suggested = suggestedOutcome(item);

  const choose = async (outcome: Outcome) => {
    setDone(null);
    setSnoozing(false);
    if (outcome === "let-go") {
      setPanel(null);
      await run("/api/desk/mail", requests.letGo(item.key));
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
  const thread = proposal?.thread ? proposal.threads.find((th) => th.slug === proposal.thread) : undefined;

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
        {link && (
          <a className="btn quiet" href={link} target="_blank" rel="noreferrer">
            {t("card.mail.open")}
          </a>
        )}
      </div>
      {panel === "attach" && (
        <div className="ivy">
          {!proposal ? (
            <span className="faint">{busy ? t("card.mail.attach.looking") : ""}</span>
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
  const { busy, error, run } = useAct();
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
        <button type="button" className="btn pri" disabled={busy} onClick={() => run("/api/desk/mail", { action: "sweep", sweep: sweep.id, keys: sweep.mails.map((m) => m.key), target: sweep.target })}>
          {t("card.sweep.letGo")}
        </button>
      </div>
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

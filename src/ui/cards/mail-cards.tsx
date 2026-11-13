import { useState } from "react";
import type { DeskItem, DoneEntry, MailSweep } from "../api/types";
import { useI18n } from "../i18n";
import { useAct } from "./act";
import { Card, ErrorLine } from "./parts";

function mailLink(item: DeskItem): string | undefined {
  return item.detail.links.find((l) => /^(message|https?):/.test(l.url))?.url ?? item.actions.find((a) => a.url)?.url;
}

export function MailCard({ item }: { item: DeskItem }) {
  const { t } = useI18n();
  const { busy, error, run } = useAct();
  const [drafting, setDrafting] = useState(false);
  const [body, setBody] = useState("");
  const [drafted, setDrafted] = useState(false);
  const link = mailLink(item);
  const saveDraft = async () => {
    const result = await run("/api/desk/mail", { action: "draft", key: item.key, body });
    if (result.ok) {
      setDrafted(true);
      setDrafting(false);
    }
  };
  return (
    <Card eyebrow={t("card.mail.eyebrow")} pill={item.suspicious ? <span className="pill wait">{t("card.mail.suspicious")}</span> : undefined}>
      <span className="q">{item.title}</span>
      {(item.excerpt || item.detail.summary) && <span className="sub">{item.excerpt || item.detail.summary}</span>}
      <span className="faint">{item.why}</span>
      {item.suspicious && item.detail.suspicion?.map((s) => <span key={s} className="faint">{s}</span>)}
      {drafted && <span className="faint">{t("card.mail.drafted")}</span>}
      {drafting ? (
        <>
          <textarea aria-label={t("card.mail.reply")} placeholder={t("card.mail.reply")} value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          <div className="row">
            <button type="button" className="btn pri" disabled={busy || !body.trim()} onClick={saveDraft}>
              {t("card.mail.saveDraft")}
            </button>
            <button type="button" className="btn quiet" onClick={() => setDrafting(false)}>
              {t("card.mail.cancel")}
            </button>
          </div>
        </>
      ) : (
        <div className="row">
          <button type="button" className="btn pri" disabled={busy} onClick={() => run("/api/desk/mail", { action: "move", key: item.key, target: "archive" })}>
            {t("card.mail.letGo")}
          </button>
          {item.todoFingerprint && (
            <button type="button" className="btn" disabled={busy} onClick={() => run("/api/desk/my-day", { op: "todo", key: item.key, fingerprint: item.todoFingerprint })}>
              {t("card.mail.keep")}
            </button>
          )}
          <button type="button" className="btn" disabled={busy} onClick={() => setDrafting(true)}>
            {t("card.mail.draft")}
          </button>
          {link && (
            <a className="btn quiet" href={link} target="_blank" rel="noreferrer">
              {t("card.mail.open")}
            </a>
          )}
        </div>
      )}
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

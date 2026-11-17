import { safeHref } from "@desk/safe-link";
import { useState } from "react";
import { captureText, NOT_A_CARD } from "@desk/capture";
import type { DeskEvent, DeskItem } from "@desk/types";
import { useI18n } from "../i18n";
import { useAct, useQueue } from "./act";
import { Card, ErrorLine, MakeTaskButton } from "./parts";

function When({ event }: { event: DeskEvent }) {
  const { t, time } = useI18n();
  const at = time(new Date(event.at));
  return <span className="sub">{event.end ? t("meeting.span", { from: at, to: time(new Date(event.end)) }) : at}</span>;
}

export function MeetingSoonCard({ item, event }: { item: DeskItem; event: DeskEvent | null }) {
  const { t } = useI18n();
  const card = useAct();
  const plan = card.offersTask(item);
  const join = safeHref(item.actions.find((a) => a.id === "open" && a.url)?.url) ?? safeHref(event?.url);
  return (
    <Card eyebrow={t("meeting.soon.eyebrow")} pill={<span className="pill wait">{t("meeting.soon.pill")}</span>}>
      <span className="q">{event?.title ?? item.title}</span>
      {event && <When event={event} />}
      {event?.note && !event.online && <span className="faint">{event.note}</span>}
      <span className="faint">{item.why}</span>
      {(join || plan) && (
        <div className="row">
          {join && (
            <a className="btn pri" href={join} target="_blank" rel="noreferrer">
              {t("meeting.soon.join")}
            </a>
          )}
          <MakeTaskButton item={item} act={card} />
        </div>
      )}
      <ErrorLine error={card.error} />
    </Card>
  );
}

export function AfterMeetingCard({ item, onDismiss, dismissBusy }: { item: DeskItem; onDismiss: () => void; dismissBusy?: boolean }) {
  const { t } = useI18n();
  const { client, refresh } = useQueue();
  const [text, setText] = useState("");
  const [kept, setKept] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const note = async () => {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    const result = await captureText(client, value);
    setBusy(false);
    if (result.ok) {
      setKept([...kept, value]);
      setText("");
      refresh();
    } else {
      setError(result.status === NOT_A_CARD ? t("meeting.after.notACard") : (result.message ?? t("error.network")));
    }
  };
  return (
    <Card itemKey={item.key} eyebrow={t("meeting.after.eyebrow")} pill={<span className="pill think">{t("card.item.new")}</span>}>
      <span className="q">{item.title}</span>
      <span className="sub">{t("meeting.after.question")}</span>
      {kept.length > 0 && (
        <ul className="plain kept">
          {kept.map((k) => (
            <li key={k}>✓ {k}</li>
          ))}
        </ul>
      )}
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input
          type="text"
          aria-label={t("meeting.after.input", { title: item.detail.summary })}
          placeholder={kept.length ? t("meeting.after.more") : t("meeting.after.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void note();
          }}
        />
        <button type="button" className={kept.length ? "btn" : "btn pri"} disabled={busy || !text.trim()} onClick={note} style={{ whiteSpace: "nowrap" }}>
          {t("meeting.after.note")}
        </button>
      </div>
      {error && (
        <span className="faint" role="alert">
          {error}
        </span>
      )}
      <div className="row">
        <button type="button" className={kept.length ? "btn pri" : "btn quiet"} onClick={onDismiss} disabled={dismissBusy}>
          {kept.length ? t("meeting.after.done") : t("meeting.after.nothing")}
        </button>
      </div>
    </Card>
  );
}

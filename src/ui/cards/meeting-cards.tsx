import { useState } from "react";
import { captureText, NOT_A_CARD } from "../api/capture";
import type { DeskEvent, DeskItem } from "../api/types";
import { useI18n } from "../i18n";
import { useQueue } from "./act";
import { Card } from "./parts";

function When({ event }: { event: DeskEvent }) {
  const { t, time } = useI18n();
  const at = time(new Date(event.at));
  return <span className="sub">{event.end ? t("meeting.span", { from: at, to: time(new Date(event.end)) }) : at}</span>;
}

export function MeetingSoonCard({ item, event }: { item: DeskItem; event: DeskEvent | null }) {
  const { t } = useI18n();
  const join = item.actions.find((a) => a.id === "open" && a.url)?.url ?? event?.url;
  return (
    <Card eyebrow={t("meeting.soon.eyebrow")} pill={<span className="pill wait">{t("meeting.soon.pill")}</span>}>
      <span className="q">{event?.title ?? item.title}</span>
      {event && <When event={event} />}
      {event?.note && !event.online && <span className="faint">{event.note}</span>}
      <span className="faint">{item.why}</span>
      {join && (
        <div className="row">
          <a className="btn pri" href={join} target="_blank" rel="noreferrer">
            {t("meeting.soon.join")}
          </a>
        </div>
      )}
    </Card>
  );
}

export function AfterMeetingCard({ event, onDismiss }: { event: DeskEvent; onDismiss: () => void }) {
  const { t, time } = useI18n();
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
    <Card eyebrow={t("meeting.after.eyebrow")} pill={<span className="pill think">{t("card.item.new")}</span>}>
      <span className="q">{t("meeting.after.title", { title: event.title, end: time(new Date(event.end ?? event.at)) })}</span>
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
          aria-label={t("meeting.after.input", { title: event.title })}
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
        <button type="button" className={kept.length ? "btn pri" : "btn quiet"} onClick={onDismiss}>
          {kept.length ? t("meeting.after.done") : t("meeting.after.nothing")}
        </button>
      </div>
    </Card>
  );
}

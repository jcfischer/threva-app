import { useState } from "react";
import type { StudioThread } from "../api/types";
import { Markdown } from "../markdown";
import { ErrorLine, Card } from "../cards/parts";
import { useI18n } from "../i18n";
import { ago } from "../i18n/ago";
import { useStudioAct } from "./act";
import { dayCard, type DayCardNote } from "./day-card";

type Run = ReturnType<typeof useStudioAct>["run"];

export interface StudioCardProps {
  thread: StudioThread;
  now: number;
  onDesk?: () => void;
}

function Pills({ thread, delivered }: { thread: StudioThread; delivered: boolean }) {
  const { t } = useI18n();
  return (
    <span className="row">
      {thread.state === "parked" && <span className="pill calm">{t("studio.parked")}</span>}
      {delivered && <span className="pill think">{t("card.thread.note")}</span>}
    </span>
  );
}

function WaitingNote({ note, now, long }: { note: DayCardNote; now: number; long: boolean }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [all, setAll] = useState(false);
  return (
    <div className="waitnote">
      <span className="faint">{ago(i18n, note.at, now)}</span>
      <div className={`waittext${long && !all ? " clamped" : ""}`}>
        <Markdown text={note.text} />
      </div>
      {long && (
        <button type="button" className="lk" aria-expanded={all} onClick={() => { setAll(!all); }}>
          {all ? t("card.thread.showLess") : t("card.thread.showAll")}
        </button>
      )}
    </div>
  );
}

function AnswerLine({ thread, busy, run }: { thread: StudioThread; busy: boolean; run: Run }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const send = async () => {
    if ((await run({ act: "respond", thread: thread.slug, text: text.trim() })).ok) setText("");
  };
  return (
    <div className="row" style={{ flexWrap: "nowrap" }}>
      <input type="text" aria-label={t("card.thread.answer")} placeholder={t("card.thread.answer")} value={text} onInput={(e) => { setText(e.currentTarget.value); }} />
      <button type="button" className="btn pri" disabled={busy || !text.trim()} onClick={() => { void send(); }}>
        {t("studio.send")}
      </button>
    </div>
  );
}

function NoteActs({ thread, note, busy, run }: { thread: StudioThread; note: DayCardNote; busy: boolean; run: Run }) {
  const { t } = useI18n();
  return (
    <div className="row">
      <button type="button" className="btn pri" disabled={busy} onClick={() => { void run({ act: "keep", thread: thread.slug, note: note.at }); }}>
        {note.kind === "stand" ? t("studio.keepStand") : t("studio.keep")}
      </button>
      <button type="button" className="btn quiet" disabled={busy} onClick={() => { void run({ act: "dismiss", thread: thread.slug, note: note.at }); }}>
        {t("studio.dismiss")}
      </button>
    </div>
  );
}

export function StudioCard({ thread, now, onDesk }: StudioCardProps) {
  const { t } = useI18n();
  const { busy, error, run } = useStudioAct();
  const card = dayCard(thread);
  return (
    <Card eyebrow={t("card.thread.eyebrow")} pill={<Pills thread={thread} delivered={card.reason !== null} />}>
      <span className="sub">{card.question}</span>
      {card.stand !== null && <span className="faint">{card.stand}</span>}
      {card.note && <WaitingNote note={card.note} now={now} long={card.long} />}
      {card.note && card.acts.includes("answer") && <AnswerLine thread={thread} busy={busy} run={run} />}
      {card.note && card.acts.includes("keep") && <NoteActs thread={thread} note={card.note} busy={busy} run={run} />}
      <ErrorLine error={error} />
      {onDesk && (
        <div className="row">
          <button type="button" className="btn" onClick={onDesk}>
            {t("desk.open")}
          </button>
        </div>
      )}
    </Card>
  );
}

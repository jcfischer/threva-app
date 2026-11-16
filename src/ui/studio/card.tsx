import { useState } from "react";
import type { StudioMaterial, StudioNote, StudioResponse, StudioThread } from "../api/types";
import { safeHref } from "../api/safe-link";
import { Markdown } from "../markdown";
import { ErrorLine, Card } from "../cards/parts";
import { useI18n, type TextKey } from "../i18n";
import { ago } from "../i18n/ago";
import { useStudioAct } from "./act";
import { CloseTopicForm } from "./close";
import { DiscussNote, TalkItThrough } from "./conversation";
import { dayCard, type DayCardNote } from "./day-card";
import { Sparring } from "./sparring";

type Run = ReturnType<typeof useStudioAct>["run"];

export type TimelineEntry = { at: string; note: StudioNote } | { at: string; response: StudioResponse };

export function timeline(thread: StudioThread): TimelineEntry[] {
  const notes = thread.notes.map((note) => ({ at: note.at, note }));
  const responses = thread.responses.map((response) => ({ at: response.at, response }));
  return [...notes, ...responses].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

const KIND: Record<StudioNote["kind"], TextKey> = { note: "studio.kind.note", stand: "studio.kind.stand", idea: "studio.kind.idea", relation: "studio.kind.relation" };
const STATUS: Record<StudioNote["status"], { key: TextKey; pill: string }> = {
  open: { key: "studio.status.open", pill: "think" },
  kept: { key: "studio.status.kept", pill: "ok" },
  dismissed: { key: "studio.status.dismissed", pill: "calm" },
};
function When({ at }: { at: string }) {
  const { date, time } = useI18n();
  const d = new Date(at);
  return <>{Number.isNaN(d.getTime()) ? at : `${date(d)}, ${time(d)}`}</>;
}

function NoteView({ note, slug, busy, run }: { note: StudioNote; slug: string; busy: boolean; run: Run }) {
  const { t } = useI18n();
  const status = STATUS[note.status];
  return (
    <div className={`stnote${note.kind === "stand" ? " stand" : ""}${note.status === "dismissed" ? " gone" : ""}`}>
      <span className="row" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">
          {t(KIND[note.kind])} · {t("studio.assistant")} · <When at={note.at} />
          {note.trigger ? ` · ${note.trigger}` : ""}
        </span>
        <span className={`pill ${status.pill}`}>{t(status.key)}</span>
      </span>
      <Markdown text={note.text} />
      {note.because && <p className="faint">{t("studio.because", { text: note.because })}</p>}
      {note.status === "open" && note.kind !== "note" && (
        <div className="row">
          <button type="button" className="btn pri" disabled={busy} onClick={() => { void run({ act: "keep", thread: slug, note: note.at }); }}>
            {note.kind === "stand" ? t("studio.keepStand") : t("studio.keep")}
          </button>
          <DiscussNote thread={slug} note={note.at} />
          <button type="button" className="btn quiet" disabled={busy} onClick={() => { void run({ act: "dismiss", thread: slug, note: note.at }); }}>
            {t("studio.dismiss")}
          </button>
        </div>
      )}
    </div>
  );
}

function ResponseView({ response }: { response: StudioResponse }) {
  const { t } = useI18n();
  return (
    <div className="stnote">
      <span className="eyebrow">
        {t("studio.you")} · <When at={response.at} />
      </span>
      <p className="typed">{response.text}</p>
    </div>
  );
}

function MaterialRail({ material }: { material: readonly StudioMaterial[] }) {
  const { t } = useI18n();
  return (
    <div className="strel">
      <span className="eyebrow">{t("studio.material")}</span>
      {material.length === 0 && <span className="faint">{t("studio.material.none")}</span>}
      {material.map((m, i) => (
        <span key={i}>
          {safeHref(m.href) ? (
            <a className="lk" href={safeHref(m.href)} target="_blank" rel="noreferrer">
              {m.label}
            </a>
          ) : (
            m.label
          )}
          {m.kind !== "link" && <span className="faint"> {m.kind}</span>}
        </span>
      ))}
    </div>
  );
}

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

/**
 * A Studio topic on the Day view: what it asks, the note that waits, and the act that answers it. "Open the desk" shows
 * the topic in full. The open view this card used to hold is retired by its own node and is reachable nowhere else.
 */
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

export interface StudioOpenProps {
  thread: StudioThread;
  waits: boolean;
  onHide: () => void;
  personas?: readonly string[];
}

/** The Studio's open view. No card reaches it; it is kept until its own node retires it. */
export function StudioOpen({ thread, waits, onHide, personas = [] }: StudioOpenProps) {
  const { t } = useI18n();
  const { busy, error, run } = useStudioAct();
  const [text, setText] = useState("");
  const [closing, setClosing] = useState(false);
  const slug = thread.slug;
  const parked = thread.state === "parked";
  const respond = async () => {
    if ((await run({ act: "respond", thread: slug, text: text.trim() })).ok) setText("");
  };
  return (
    <div className="studio card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="row">
          <span className="eyebrow">{t("card.thread.eyebrow")}</span>
          <Pills thread={thread} delivered={waits} />
        </span>
        <button type="button" className="btn quiet" onClick={onHide}>
          {t("studio.hide")}
        </button>
      </div>
      <h2 className="stq">{thread.question}</h2>
      <div className="stgrid">
        <div className="stmain">
          <div className="ststand">
            <span className="eyebrow">{t("studio.stand")}</span>
            <p>{thread.stand || t("studio.stand.none")}</p>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {timeline(thread).map((e) =>
              "note" in e ? <NoteView key={`n${e.at}`} note={e.note} slug={slug} busy={busy} run={run} /> : <ResponseView key={`r${e.at}`} response={e.response} />,
            )}
          </div>
          <textarea aria-label={t("studio.response")} placeholder={t("studio.response")} value={text} onChange={(e) => { setText(e.target.value); }} rows={3} />
          <div className="row">
            <button type="button" className="btn pri" disabled={busy || !text.trim()} onClick={() => { void respond(); }}>
              {t("studio.send")}
            </button>
          </div>
          <ErrorLine error={error} />
          <TalkItThrough thread={slug} />
          {closing ? (
            <CloseTopicForm thread={thread} busy={busy} run={run} onCancel={() => { setClosing(false); }} />
          ) : (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button
                type="button"
                className={`btn${thread.thinkTonight ? " pri" : ""}`}
                aria-pressed={thread.thinkTonight ?? false}
                disabled={busy}
                onClick={() => { void run({ act: "think", thread: slug, on: !thread.thinkTonight }); }}
              >
                {t("studio.tonight")}
              </button>
              <span className="row">
                <button type="button" className="btn" disabled={busy} onClick={() => { setClosing(true); }}>
                  {t("studio.finish")}
                </button>
                <button type="button" className="btn quiet" disabled={busy} onClick={() => { void run({ act: parked ? "unpark" : "park", thread: slug }); }}>
                  {parked ? t("studio.unpark") : t("studio.park")}
                </button>
              </span>
            </div>
          )}
        </div>
        <div className="stside">
          <Sparring thread={thread} personas={personas} />
          <MaterialRail material={thread.material ?? []} />
        </div>
      </div>
    </div>
  );
}

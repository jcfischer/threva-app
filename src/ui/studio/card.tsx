import { useState } from "react";
import type { StudioAct, StudioMaterial, StudioNote, StudioOutcome, StudioResponse, StudioThread } from "../api/types";
import { safeHref } from "../api/safe-link";
import { ErrorLine, Card } from "../cards/parts";
import { useI18n, type TextKey } from "../i18n";
import { useStudioAct } from "./act";

type Run = ReturnType<typeof useStudioAct>["run"];

export type TimelineEntry = { at: string; note: StudioNote } | { at: string; response: StudioResponse };

/** Notes and responses in time order. Relation notes stay out until Cortex serves relations (F27). */
export function timeline(thread: StudioThread): TimelineEntry[] {
  const notes = thread.notes.filter((n) => n.kind !== "relation").map((note) => ({ at: note.at, note }));
  const responses = thread.responses.map((response) => ({ at: response.at, response }));
  return [...notes, ...responses].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

const KIND: Record<Exclude<StudioNote["kind"], "relation">, TextKey> = { note: "studio.kind.note", stand: "studio.kind.stand", idea: "studio.kind.idea" };
const STATUS: Record<StudioNote["status"], { key: TextKey; pill: string }> = {
  open: { key: "studio.status.open", pill: "think" },
  kept: { key: "studio.status.kept", pill: "ok" },
  dismissed: { key: "studio.status.dismissed", pill: "calm" },
};
const OUTCOMES: { id: StudioOutcome; key: TextKey }[] = [
  { id: "decided", key: "studio.outcome.decided" },
  { id: "shipped", key: "studio.outcome.shipped" },
  { id: "dropped", key: "studio.outcome.dropped" },
];

function When({ at }: { at: string }) {
  const { date, time } = useI18n();
  const d = new Date(at);
  return <>{Number.isNaN(d.getTime()) ? at : `${date(d)}, ${time(d)}`}</>;
}

function NoteView({ note, slug, busy, run }: { note: StudioNote; slug: string; busy: boolean; run: Run }) {
  const { t } = useI18n();
  const kind = note.kind === "relation" ? "note" : note.kind;
  const status = STATUS[note.status];
  return (
    <div className={`stnote${note.kind === "stand" ? " stand" : ""}${note.status === "dismissed" ? " gone" : ""}`}>
      <span className="row" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">
          {t(KIND[kind])} · {t("studio.assistant")} · <When at={note.at} />
          {note.trigger ? ` · ${note.trigger}` : ""}
        </span>
        <span className={`pill ${status.pill}`}>{t(status.key)}</span>
      </span>
      <p>{note.text}</p>
      {note.because && <p className="faint">{t("studio.because", { text: note.because })}</p>}
      {note.status === "open" && note.kind !== "note" && (
        <div className="row">
          <button type="button" className="btn pri" disabled={busy} onClick={() => run({ act: "keep", thread: slug, note: note.at })}>
            {note.kind === "stand" ? t("studio.keepStand") : t("studio.keep")}
          </button>
          <button type="button" className="btn" disabled title={t("studio.discussLater")}>
            {t("studio.discuss")}
          </button>
          <button type="button" className="btn quiet" disabled={busy} onClick={() => run({ act: "dismiss", thread: slug, note: note.at })}>
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
      <p>{response.text}</p>
    </div>
  );
}

function MaterialRail({ material }: { material: readonly StudioMaterial[] }) {
  const { t } = useI18n();
  return (
    <div className="stside">
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
    </div>
  );
}

export interface CloseFields {
  outcome: StudioOutcome;
  text: string;
  expect: string;
  reviewOn: string;
}

/** The close act for the form, or null while it lacks what Cortex asks for: a text, and for a decision also what you expect and a review date. */
export function closeAct(thread: string, f: CloseFields): StudioAct | null {
  const text = f.text.trim();
  if (!text) return null;
  if (f.outcome !== "decided") return { act: "close", thread, outcome: f.outcome, text };
  const expect = f.expect.trim();
  if (!expect || !f.reviewOn) return null;
  return { act: "close", thread, outcome: "decided", text, expect, reviewOn: f.reviewOn };
}

function CloseForm({ slug, busy, run, onCancel }: { slug: string; busy: boolean; run: Run; onCancel: () => void }) {
  const { t } = useI18n();
  const [outcome, setOutcome] = useState<StudioOutcome>("decided");
  const [text, setText] = useState("");
  const [expect, setExpect] = useState("");
  const [reviewOn, setReviewOn] = useState("");
  const act = closeAct(slug, { outcome, text, expect, reviewOn });
  const send = async () => {
    if (act && (await run(act))) onCancel();
  };
  return (
    <div className="stack">
      <span className="eyebrow">{t("studio.finish")}</span>
      <div className="row" role="radiogroup" aria-label={t("studio.outcome")}>
        {OUTCOMES.map((o) => (
          <label key={o.id} className="sttog">
            <input type="radio" name={`outcome-${slug}`} checked={outcome === o.id} onChange={() => setOutcome(o.id)} />
            {t(o.key)}
          </label>
        ))}
      </div>
      <textarea aria-label={t("studio.outcomeText")} placeholder={t("studio.outcomeText")} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      {outcome === "decided" && (
        <>
          <input type="text" aria-label={t("studio.expect")} placeholder={t("studio.expect")} value={expect} onChange={(e) => setExpect(e.target.value)} />
          <label className="faint">
            {t("studio.reviewOn")}
            <input type="date" value={reviewOn} onChange={(e) => setReviewOn(e.target.value)} />
          </label>
        </>
      )}
      <div className="row">
        <button type="button" className="btn pri" disabled={busy || !act} onClick={send}>
          {t("studio.closeSend")}
        </button>
        <button type="button" className="btn quiet" disabled={busy} onClick={onCancel}>
          {t("studio.cancel")}
        </button>
      </div>
    </div>
  );
}

export interface StudioCardProps {
  thread: StudioThread;
  waits: boolean;
  open: boolean;
  onOpen: () => void;
  onHide: () => void;
}

export function StudioCard(props: StudioCardProps) {
  return props.open ? <StudioOpen {...props} /> : <StudioClosed {...props} />;
}

function Pills({ thread, waits }: { thread: StudioThread; waits: boolean }) {
  const { t } = useI18n();
  return (
    <span className="row">
      {thread.state === "parked" && <span className="pill calm">{t("studio.parked")}</span>}
      {waits && <span className="pill think">{t("card.thread.waits")}</span>}
    </span>
  );
}

function StudioClosed({ thread, waits, onOpen }: StudioCardProps) {
  const { t } = useI18n();
  return (
    <Card eyebrow={t("card.thread.eyebrow")} pill={<Pills thread={thread} waits={waits} />}>
      <span className="q">{thread.question}</span>
      {thread.stand && <span className="sub">{thread.stand}</span>}
      <div className="row">
        <button type="button" className="btn pri" onClick={onOpen}>
          {t("studio.open")}
        </button>
      </div>
    </Card>
  );
}

function StudioOpen({ thread, waits, onHide }: StudioCardProps) {
  const { t } = useI18n();
  const { busy, error, run } = useStudioAct();
  const [text, setText] = useState("");
  const [closing, setClosing] = useState(false);
  const slug = thread.slug;
  const parked = thread.state === "parked";
  const respond = async () => {
    if (await run({ act: "respond", thread: slug, text: text.trim() })) setText("");
  };
  return (
    <div className="studio card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="row">
          <span className="eyebrow">{t("card.thread.eyebrow")}</span>
          <Pills thread={thread} waits={waits} />
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
          <textarea aria-label={t("studio.response")} placeholder={t("studio.response")} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          <div className="row">
            <button type="button" className="btn pri" disabled={busy || !text.trim()} onClick={respond}>
              {t("studio.send")}
            </button>
          </div>
          <ErrorLine error={error} />
          {closing ? (
            <CloseForm slug={slug} busy={busy} run={run} onCancel={() => setClosing(false)} />
          ) : (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button
                type="button"
                className={`btn${thread.thinkTonight ? " pri" : ""}`}
                aria-pressed={thread.thinkTonight ?? false}
                disabled={busy}
                onClick={() => run({ act: "think", thread: slug, on: !thread.thinkTonight })}
              >
                {t("studio.tonight")}
              </button>
              <span className="row">
                <button type="button" className="btn" disabled={busy} onClick={() => setClosing(true)}>
                  {t("studio.finish")}
                </button>
                <button type="button" className="btn quiet" disabled={busy} onClick={() => run({ act: parked ? "unpark" : "park", thread: slug })}>
                  {parked ? t("studio.unpark") : t("studio.park")}
                </button>
              </span>
            </div>
          )}
        </div>
        <MaterialRail material={thread.material ?? []} />
      </div>
    </div>
  );
}

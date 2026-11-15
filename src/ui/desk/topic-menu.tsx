import { useState } from "react";
import type { Result } from "../api/client";
import type { StudioAct, StudioOutcome, StudioThread, StudioThreadType } from "../api/types";
import type { ActError } from "../cards/act";
import { ErrorLine } from "../cards/parts";
import { useI18n, type TextKey } from "../i18n";

export type RunAct = (act: StudioAct) => Promise<Result<{ message?: string }>>;

export const OUTCOME_LABEL: Record<StudioOutcome, TextKey> = {
  decided: "studio.outcome.decided",
  shipped: "studio.outcome.shipped",
  dropped: "studio.outcome.dropped",
};

const CLOSE_TEXT: Record<StudioOutcome, TextKey> = {
  decided: "desk.close.decision",
  shipped: "desk.close.shipped",
  dropped: "desk.close.dropped",
};

const BY_TYPE: Record<StudioThreadType, readonly StudioOutcome[]> = {
  question: ["decided", "dropped"],
  making: ["shipped", "dropped"],
  topic: ["decided", "shipped", "dropped"],
};

/** Cortex's three types, with a thread that carries none read as a question. */
export function threadType(thread: Pick<StudioThread, "type">): StudioThreadType {
  return thread.type ?? "question";
}

/** The ways a topic of this type can end. */
export function outcomesFor(type: StudioThreadType): readonly StudioOutcome[] {
  return BY_TYPE[type];
}

/** The stand as one quiet line, on a question topic with a stand that is not empty, and nowhere else. */
export function standLine(thread: StudioThread): string | null {
  return threadType(thread) === "question" ? thread.stand.trim() || null : null;
}

export interface CloseFields {
  outcome: StudioOutcome;
  text: string;
  expect: string;
  reviewOn: string;
}

/** The close act for the form, or null while it lacks what Cortex asks for that type: a text, and for a decision also what you expect and a review date. */
export function closeAct(thread: string, f: CloseFields, type: StudioThreadType = "question"): StudioAct | null {
  if (!outcomesFor(type).includes(f.outcome)) return null;
  const text = f.text.trim();
  if (!text) return null;
  if (f.outcome !== "decided") return { act: "close", thread, outcome: f.outcome, text };
  const expect = f.expect.trim();
  if (!expect || !f.reviewOn) return null;
  return { act: "close", thread, outcome: "decided", text, expect, reviewOn: f.reviewOn };
}

export interface CloseTopicFormProps {
  thread: StudioThread;
  busy: boolean;
  run: RunAct;
  onCancel: () => void;
}

/** Finishing a topic: the outcomes its type allows, the text they ask for, and for a decision what you expect and a review date. */
export function CloseTopicForm({ thread, busy, run, onCancel }: CloseTopicFormProps) {
  const { t } = useI18n();
  const type = threadType(thread);
  const outcomes = outcomesFor(type);
  const [outcome, setOutcome] = useState<StudioOutcome>(outcomes[0]);
  const [text, setText] = useState("");
  const [expect, setExpect] = useState("");
  const [reviewOn, setReviewOn] = useState("");
  const [error, setError] = useState<ActError>(null);
  const act = closeAct(thread.slug, { outcome, text, expect, reviewOn }, type);
  const send = async () => {
    if (!act) return;
    setError(null);
    const result = await run(act);
    if (result.ok) onCancel();
    else setError({ message: result.message });
  };
  const textLabel = t(CLOSE_TEXT[outcome]);
  return (
    <div className="stack" role="group" aria-label={t("desk.finish")}>
      <div className="row" role="radiogroup" aria-label={t("studio.outcome")}>
        {outcomes.map((id) => (
          <label key={id} className="sttog">
            <input type="radio" name={`outcome-${thread.slug}`} checked={outcome === id} onChange={() => { setOutcome(id); }} />
            {t(OUTCOME_LABEL[id])}
          </label>
        ))}
      </div>
      <textarea aria-label={textLabel} placeholder={textLabel} value={text} onInput={(e) => { setText(e.currentTarget.value); }} rows={3} />
      {outcome === "decided" && (
        <>
          <input type="text" aria-label={t("studio.expect")} placeholder={t("studio.expect")} value={expect} onInput={(e) => { setExpect(e.currentTarget.value); }} />
          <label className="faint">
            {t("studio.reviewOn")}
            <input type="date" value={reviewOn} onInput={(e) => { setReviewOn(e.currentTarget.value); }} />
          </label>
        </>
      )}
      <div className="row">
        <button type="button" className="btn pri" disabled={busy || !act} onClick={() => { void send(); }}>
          {t("studio.closeSend")}
        </button>
        <button type="button" className="btn quiet" disabled={busy} onClick={onCancel}>
          {t("studio.cancel")}
        </button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

export interface TopicMenuProps {
  thread: StudioThread;
  busy: boolean;
  run: RunAct;
}

/** The topic's own acts in one quiet menu at the top of the desk: think about it tonight, park, and finish. */
export function TopicMenu({ thread, busy, run }: TopicMenuProps) {
  const { t } = useI18n();
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<ActError>(null);
  const parked = thread.state === "parked";
  const tonight = thread.thinkTonight === true;
  const send = async (act: StudioAct) => {
    setError(null);
    const result = await run(act);
    if (!result.ok) setError({ message: result.message });
  };
  return (
    <details className="desk-menu" data-desk-menu="true">
      <summary>{t("desk.menu")}</summary>
      <div className="desk-menu-body">
        {finishing ? (
          <CloseTopicForm thread={thread} busy={busy} run={run} onCancel={() => { setFinishing(false); setError(null); }} />
        ) : (
          <>
            <button type="button" role="switch" aria-checked={tonight} className={`btn${tonight ? " pri" : " quiet"}`} disabled={busy} onClick={() => { void send({ act: "think", thread: thread.slug, on: !tonight }); }}>
              {t("desk.tonight")}
            </button>
            <button type="button" className="btn quiet" disabled={busy} onClick={() => { void send({ act: parked ? "unpark" : "park", thread: thread.slug }); }}>
              {parked ? t("desk.unpark") : t("desk.park")}
            </button>
            <button type="button" className="btn quiet" disabled={busy} onClick={() => { setFinishing(true); }}>
              {t("desk.finish")}
            </button>
            <ErrorLine error={error} />
          </>
        )}
      </div>
    </details>
  );
}

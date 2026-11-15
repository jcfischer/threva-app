import { useState } from "react";
import type { StudioAct, StudioThread } from "../api/types";
import type { ActError } from "../cards/act";
import { ErrorLine } from "../cards/parts";
import { useI18n } from "../i18n";
import { CloseTopicForm, OUTCOME_LABEL, threadType, type RunAct } from "../studio/close";

/** The stand as one quiet line, on a question topic with a stand that is not empty, and nowhere else. */
export function standLine(thread: StudioThread): string | null {
  return threadType(thread) === "question" ? thread.stand.trim() || null : null;
}

/** A closed thread's outcome and outcome text under the heading, or the plain closed line when Cortex carries no outcome. */
export function TopicOutcome({ thread }: { thread: StudioThread }) {
  const { t } = useI18n();
  if (!thread.outcome) return <p className="desk-outcome faint">{t("thread.closed")}</p>;
  return (
    <p className="desk-outcome" data-desk-outcome={thread.outcome}>
      <span className={`pill ${thread.outcome === "dropped" ? "calm" : "ok"}`}>{t(OUTCOME_LABEL[thread.outcome])}</span>
      {thread.outcomeText ? <span>{thread.outcomeText}</span> : null}
    </p>
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

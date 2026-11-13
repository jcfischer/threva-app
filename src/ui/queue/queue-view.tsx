import { useState } from "react";
import type { DeskClient } from "../api/client";
import { QueueContext } from "../cards/act";
import { AgentCard, ItemCard, TaskCard, ThreadCard } from "../cards/queue-cards";
import { useI18n } from "../i18n";
import { buildQueue, EMPTY_SESSION, pin, skip, type Entry, type Session } from "./order";
import { useDesk, type DeskState } from "./use-desk";

export function EntryCard({ entry }: { entry: Entry }) {
  switch (entry.type) {
    case "agent":
      return <AgentCard item={entry.item} />;
    case "thread":
      return <ThreadCard thread={entry.thread} />;
    case "item":
      return <ItemCard item={entry.item} fresh={entry.fresh} />;
    case "task":
      return <TaskCard task={entry.task} />;
  }
}

export function QueueBody({ state, session, setSession, now }: { state: DeskState; session: Session; setSession: (s: Session) => void; now: number }) {
  const { t, tn } = useI18n();
  if (!state.view) {
    return <p className="faint">{state.error ? (state.error.message ?? t("error.network")) : t("queue.loading")}</p>;
  }
  const queue = buildQueue(state.view, state.studio, session, now);
  const first = queue[0];
  return (
    <section className="queue" aria-label={t("queue.label")}>
      {state.error && (
        <p className="faint" role="alert">
          {state.error.message ?? t("error.network")}
        </p>
      )}
      <div className="whyline">
        <span>{tn("queue.count", queue.length)}</span>
      </div>
      {first ? (
        <>
          <EntryCard key={first.k} entry={first} />
          <div className="row">
            <button type="button" className="btn quiet" disabled={queue.length < 2} onClick={() => setSession(skip(session, first.k))}>
              {t("queue.skip")}
            </button>
            <button type="button" className="btn quiet" onClick={() => setSession(pin(session, first.k))}>
              {session.pin === first.k ? t("queue.unpin") : t("queue.pin")}
            </button>
          </div>
        </>
      ) : (
        <p className="sub">{t("queue.empty")}</p>
      )}
    </section>
  );
}

export function QueueView({ client }: { client: DeskClient }) {
  const state = useDesk(client);
  const [session, setSession] = useState<Session>(EMPTY_SESSION);
  return (
    <QueueContext.Provider value={{ client, refresh: state.refresh }}>
      <QueueBody state={state} session={session} setSession={setSession} now={Date.now()} />
    </QueueContext.Provider>
  );
}

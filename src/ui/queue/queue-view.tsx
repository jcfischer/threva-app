import { useState, type ReactNode } from "react";
import type { DeskClient } from "../api/client";
import { QueueContext } from "../cards/act";
import { MailCard, RuleOfferCard, SweepCard, UndoLine } from "../cards/mail-cards";
import { AfterMeetingCard, MeetingSoonCard } from "../cards/meeting-cards";
import { AgentCard, ItemCard, TaskCard, ThreadCard } from "../cards/queue-cards";
import { useI18n } from "../i18n";
import { around, type ThenLine, type WhyNow } from "./around";
import { useDismissedMeetings } from "./dismissed";
import { buildQueue, EMPTY_SESSION, pin, skip, type Entry, type Session } from "./order";
import type { DeskState } from "./use-desk";

export function EntryCard({ entry, onDismissMeeting }: { entry: Entry; onDismissMeeting: (key: string) => void }) {
  switch (entry.type) {
    case "soon":
      return <MeetingSoonCard item={entry.item} event={entry.event} />;
    case "after":
      return <AfterMeetingCard event={entry.event} onDismiss={() => onDismissMeeting(entry.event.key)} />;
    case "agent":
      return <AgentCard item={entry.item} />;
    case "thread":
      return <ThreadCard thread={entry.thread} />;
    case "item":
      return <ItemCard item={entry.item} fresh={entry.fresh} />;
    case "mail":
      return <MailCard item={entry.item} learning={entry.learning} />;
    case "rule":
      return <RuleOfferCard item={entry.item} />;
    case "sweep":
      return <SweepCard sweep={entry.sweep} />;
    case "task":
      return <TaskCard task={entry.task} />;
  }
}

function WhyNowText({ why }: { why: WhyNow }) {
  const { t } = useI18n();
  const text =
    why.kind === "cortex" ? why.text : why.kind === "after" ? t("queue.why.after", { title: why.title }) : why.kind === "thread" ? t("queue.why.thread") : t("queue.why.task");
  return (
    <span>
      <b>{t("queue.why")}</b> {text}
    </span>
  );
}

function ThenLineView({ then, onPull }: { then: ThenLine; onPull: (k: string) => void }) {
  const { t, tn } = useI18n();
  const parts: ReactNode[] = [
    ...then.titles.map((title, i) => <span key={`t${i}`}>{title}</span>),
    ...(then.more > 0 ? [<span key="more" className="faint">{tn("queue.then.more", then.more)}</span>] : []),
    ...then.sweeps.map((s) => (
      <button key={s.k} type="button" className="lk" onClick={() => onPull(s.k)}>
        {tn("queue.then.sweep", s.count, { label: s.label })}
      </button>
    )),
  ];
  return (
    <div className="nextline">
      <span className="eyebrow">{t("queue.then")}</span>
      {parts.flatMap((part, i) => (i === 0 ? [part] : [<span key={`d${i}`} className="faint">·</span>, part]))}
    </div>
  );
}

export interface QueueBodyProps {
  state: DeskState;
  session: Session;
  setSession: (s: Session) => void;
  now: number;
  dismissed?: readonly string[];
  onDismissMeeting?: (key: string) => void;
}

export function QueueBody({ state, session, setSession, now, dismissed = [], onDismissMeeting = () => {} }: QueueBodyProps) {
  const { t, tn } = useI18n();
  if (!state.view) {
    return <p className="faint">{state.error ? (state.error.message ?? t("error.network")) : t("queue.loading")}</p>;
  }
  const queue = buildQueue(state.view, state.studio, session, now, dismissed, state.rules ?? null);
  const first = queue[0];
  const { why, then } = around(queue);
  return (
    <section className="cards" aria-label={t("queue.label")}>
      {state.error && (
        <p className="faint" role="alert">
          {state.error.message ?? t("error.network")}
        </p>
      )}
      <UndoLine done={state.view.autonomy?.done ?? []} now={now} />
      <div className="whyline">
        {why && <WhyNowText why={why} />}
        <span>{tn("queue.count", queue.length)}</span>
      </div>
      {first ? (
        <>
          <EntryCard key={first.k} entry={first} onDismissMeeting={onDismissMeeting} />
          <div className="row">
            <button type="button" className="btn quiet" disabled={queue.length < 2} onClick={() => setSession(skip(session, first.k))}>
              {t("queue.skip")}
            </button>
            <button type="button" className="btn quiet" onClick={() => setSession(pin(session, first.k))}>
              {session.pin === first.k ? t("queue.unpin") : t("queue.pin")}
            </button>
          </div>
          {then && <ThenLineView then={then} onPull={(k) => setSession(pin(session, k))} />}
        </>
      ) : (
        <p className="sub">{t("queue.empty")}</p>
      )}
    </section>
  );
}

export function QueueView({ client, state }: { client: DeskClient; state: DeskState & { refresh: () => void } }) {
  const [session, setSession] = useState<Session>(EMPTY_SESSION);
  const [dismissed, dismiss] = useDismissedMeetings();
  return (
    <QueueContext.Provider value={{ client, refresh: state.refresh }}>
      <QueueBody state={state} session={session} setSession={setSession} now={Date.now()} dismissed={dismissed} onDismissMeeting={dismiss} />
    </QueueContext.Provider>
  );
}

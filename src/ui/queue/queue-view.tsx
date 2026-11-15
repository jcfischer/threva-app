import { useEffect, useState, type ReactNode } from "react";
import type { DeskClient } from "../api/client";
import { QueueContext, useQueue } from "../cards/act";
import { InterruptionFeedback } from "../cards/interruption";
import { CardFooterContext } from "../cards/parts";
import { MailCard, RuleOfferCard, SweepCard, UndoLine, WaitingCard } from "../cards/mail-cards";
import { AfterMeetingCard, MeetingSoonCard } from "../cards/meeting-cards";
import { AgentCard, ItemCard, TaskCard } from "../cards/queue-cards";
import { StudioCard } from "../studio/card";
import { useI18n, type I18n } from "../i18n";
import { around, interruptionReasonMessage, type ThenLine, type WhyNow } from "./around";
import { allowsCardKey, keyMap } from "./keys";
import { buildQueue, pin, skip, type Entry, type Session } from "./order";
import type { DeskState } from "./use-desk";

export function EntryCard({ entry, onDismissMeeting, onOpenDesk, now = Date.now() }: {
  entry: Entry;
  onDismissMeeting: (key: string) => void;
  /** Opens a Studio topic's desk. Without it a topic card shows no way out. */
  onOpenDesk?: (slug: string) => void;
  /** The clock a card reads "how long ago" against. */
  now?: number;
}) {
  switch (entry.type) {
    case "soon":
      return <MeetingSoonCard item={entry.item} event={entry.event} />;
    case "after":
      return <AfterMeetingCard event={entry.event} onDismiss={() => onDismissMeeting(entry.event.key)} />;
    case "agent":
      return <AgentCard item={entry.item} />;
    case "thread":
      return (
        <StudioCard
          thread={entry.thread}
          now={now}
          onDesk={onOpenDesk && (() => onOpenDesk(entry.thread.slug))}
        />
      );
    case "item":
      return entry.item.kind === "mail-waiting" ? <WaitingCard item={entry.item} fresh={entry.fresh} /> : <ItemCard item={entry.item} fresh={entry.fresh} />;
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

function whyText(why: WhyNow, t: I18n["t"]): string {
  switch (why.kind) {
    case "interrupt": {
      const reasonKey = interruptionReasonMessage(why.reason.code);
      if (!reasonKey) return why.text;
      const label = t(reasonKey, { target: why.reason.target ?? "" });
      return why.text ? `${label} · ${why.text}` : label;
    }
    case "cortex":
      return why.text;
    case "after":
      return t("queue.why.after", { title: why.title });
    case "thread":
      return t("queue.why.thread");
    case "task":
      return t("queue.why.task");
  }
}

function WhyNowText({ why }: { why: WhyNow }) {
  const { t } = useI18n();
  return (
    <span>
      <b>{t("queue.why")}</b> {whyText(why, t)}
    </span>
  );
}

function ThenLineView({ then, onPull }: { then: ThenLine; onPull: (k: string) => void }) {
  const { t, tn } = useI18n();
  const parts: ReactNode[] = [
    ...then.titles.map(({ k, title }) => <button key={k} type="button" className="lk" onClick={() => onPull(k)}>{title}</button>),
    ...(then.more > 0 ? [<span key="more" className="faint">{tn("queue.then.more", then.more)}</span>] : []),
    ...then.sweeps.map((s) => (
      <button key={s.k} type="button" className="lk" onClick={() => onPull(s.k)}>
        {tn(s.archive ? "queue.then.sweepArchive" : "queue.then.sweep", s.count, { label: s.label })}
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
  onOpenDesk?: (slug: string) => void;
}

export function QueueBody({ state, session, setSession, now, dismissed = [], onDismissMeeting = () => {}, onOpenDesk }: QueueBodyProps) {
  const { t, tn } = useI18n();
  const outer = useQueue();
  // The last item made a task. Its card leaves the queue, so the queue says where it went. Cortex returns no undo
  // receipt for that move, so the line offers no Undo. It stays on the card that came next and goes when that one does.
  const [added, setAdded] = useState<{ title: string; next?: string } | null>(null);
  // Retain successful feedback while navigating cards, including before the next poll arrives.
  const [answers, setAnswers] = useState<ReadonlyMap<string, "yes" | "no">>(() => new Map());
  const queue = state.view ? buildQueue(state.view, state.studio, session, now, dismissed, state.rules ?? null) : [];
  const first = queue[0];
  const front = first?.k ?? "";
  useEffect(() => {
    setAdded((a) => (!a ? a : a.next === undefined ? { ...a, next: front } : a.next === front ? a : null));
  }, [front]);
  const keys = keyMap(first);
  const escape = () => {
    if (!first || !keys) return;
    if (keys.esc.kind === "dismiss" && first.type === "after") onDismissMeeting(first.event.key);
    else setSession(skip(session, first.k));
  };
  useEffect(() => {
    if (!first) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !allowsCardKey(event)) return;
      event.preventDefault();
      escape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!state.view) {
    return <p className="faint">{state.error ? (state.error.message ?? t("error.network")) : t("queue.loading")}</p>;
  }
  const { why, then } = around(queue);
  return (
    <QueueContext.Provider value={{ ...outer, myDayDate: state.view.myDay?.date, onTask: (title) => setAdded({ title }) }}>
      <section className="cards" aria-label={t("queue.label")}>
        {state.error && (
          <p className="faint" role="alert">
            {state.error.message ?? t("error.network")}
          </p>
        )}
        {added !== null && (
          <div className="toast row" role="status">
            <span>{t("card.task.added", { title: added.title })}</span>
          </div>
        )}
        <UndoLine done={state.view.autonomy?.done ?? []} now={now} />
        <div className="whyline">
          {why && <WhyNowText why={why} />}
          <span>{tn("queue.count", queue.length)}</span>
        </div>
        {first ? (
          <>
            <CardFooterContext.Provider value={"item" in first ? <InterruptionFeedback
              key={first.k}
              item={first.item}
              answer={answers.get(first.item.key)}
              onAnswer={answer => setAnswers(current => new Map(current).set(first.item.key, answer))}
            /> : null}>
              <EntryCard
                key={first.k}
                entry={first}
                onDismissMeeting={onDismissMeeting}
                onOpenDesk={onOpenDesk}
                now={now}
              />
            </CardFooterContext.Provider>
            {keys && <div className="keyhint">
              {keys.enter && <span><kbd>{t("queue.key.enter")}</kbd> {t(keys.enter.label)}</span>}
              <span><kbd>{t("queue.key.esc")}</kbd> {t(keys.esc.label)}</span>
            </div>}
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
    </QueueContext.Provider>
  );
}

export function QueueView({ client, state, ...body }: QueueBodyProps & { client: DeskClient; state: DeskState & { refresh: () => void } }) {
  return (
    <QueueContext.Provider value={{ client, refresh: state.refresh }}>
      <QueueBody state={state} {...body} />
    </QueueContext.Provider>
  );
}

import { useMemo, useState } from "react";
import { createClient, type DeskClient } from "./api/client";
import { Bar } from "./bar/bar";
import { Footer } from "./day/footer";
import { TimelineView } from "./day/timeline-view";
import { clockAt } from "./day/timeline";
import { useI18n } from "./i18n";
import { QueueView } from "./queue/queue-view";
import { useDismissedMeetings } from "./queue/dismissed";
import { buildQueue, EMPTY_SESSION, pin, type Session } from "./queue/order";
import { useDesk, type DeskState } from "./queue/use-desk";

export function Header() {
  const { t } = useI18n();
  return (
    <header>
      <h1>{t("app.title")}</h1>
      <p className="faint">{t("app.tagline")}</p>
    </header>
  );
}

export function App({ client }: { client?: DeskClient }) {
  const desk = useMemo(() => client ?? createClient(), [client]);
  const state = useDesk(desk);
  const [session, setSession] = useState<Session>(EMPTY_SESSION);
  const [dismissed, dismiss] = useDismissedMeetings();
  return (
    <main className="wrap">
      <Header />
      <Bar client={desk} onChange={state.refresh} />
      <DayView client={desk} state={state} session={session} setSession={setSession} now={Date.now()} dismissed={dismissed} onDismissMeeting={dismiss} />
    </main>
  );
}

export function DayView({ client, state, session, setSession, now, dismissed = [], onDismissMeeting = () => {} }: {
  client: DeskClient;
  state: DeskState & { refresh: () => void };
  session: Session;
  setSession: (s: Session) => void;
  now: number;
  dismissed?: readonly string[];
  onDismissMeeting?: (key: string) => void;
}) {
  const queue = state.view ? buildQueue(state.view, state.studio, session, now, dismissed) : [];
  const onPull = (k: string) => setSession(session.pin === k ? session : pin(session, k));
  return (
    <div className="daygrid one">
      <QueueView client={client} state={state} session={session} setSession={setSession} now={now} dismissed={dismissed} onDismissMeeting={onDismissMeeting} />
      {state.view && <aside className="rail">
        <TimelineView today={state.view.today} tasks={state.view.myDay?.items ?? []} clock={clockAt(now)} queue={queue} onPull={onPull} />
        <Footer view={state.view} now={now} queue={queue} onPull={onPull} />
      </aside>}
    </div>
  );
}

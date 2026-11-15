import { useEffect, useMemo, useState } from "react";
import { createClient, type DeskClient } from "./api/client";
import { Bar } from "./bar/bar";
import { Footer } from "./day/footer";
import { TimelineView } from "./day/timeline-view";
import { clockAt } from "./day/timeline";
import { useI18n } from "./i18n";
import { QueueView } from "./queue/queue-view";
import { useDismissedMeetings } from "./queue/dismissed";
import { buildQueue, EMPTY_SESSION, pin, type Entry, type Session } from "./queue/order";
import { useDesk, type DeskState } from "./queue/use-desk";
import { EverythingView } from "./everything/view";
import { Desk } from "./desk/desk";
import { browserNotifier, interruptionWatcher, type Notifier } from "./queue/notifier";
import { NotifyControl } from "./day/notify-control";

type Place = "day" | "everything";

export function ViewSwitch({ view, onChange }: { view: "day" | "everything"; onChange: (view: "day" | "everything") => void }) {
  const { t } = useI18n();
  return <div className="seg view-switch" role="group" aria-label={t("view.label")}>
    {(["day", "everything"] as const).map(key => <button type="button" key={key} aria-pressed={view === key} onClick={() => { onChange(key); }}>{t(`view.${key}`)}</button>)}
  </div>;
}

export function Header() {
  const { t } = useI18n();
  return (
    <header>
      <h1>{t("app.title")}</h1>
      <p className="faint">{t("app.tagline")}</p>
    </header>
  );
}

export function App({ client, notifier: givenNotifier }: { client?: DeskClient; notifier?: Notifier }) {
  const api = useMemo(() => client ?? createClient(), [client]);
  const notifier = useMemo(() => givenNotifier ?? browserNotifier(), [givenNotifier]);
  const state = useDesk(api);
  const [session, setSession] = useState<Session>(EMPTY_SESSION);
  const [dismissed, dismiss] = useDismissedMeetings();
  const [view, setView] = useState<"day" | "everything">("day");
  const [openedEverything, setOpenedEverything] = useState(false);
  const [desk, setDesk] = useState<{ slug: string; from: Place } | null>(null);
  const watchInterruptions = useMemo(() => interruptionWatcher(notifier, key => {
    setView("day");
    setDesk(null);
    setSession(current => ({ ...current, pin: `i:${key}`, open: null, skip: current.skip.filter(k => k !== `i:${key}`) }));
  }), [notifier]);
  useEffect(() => {
    if (state.view) watchInterruptions(state.view.items);
  }, [state.view, watchInterruptions]);
  const now = Date.now();
  const queue = state.view ? buildQueue(state.view, state.studio, session, now, dismissed, state.rules ?? null) : [];
  const pull = (k: string) => { setSession((current) => (current.pin === k ? current : pin(current, k))); };
  return (
    <main className={`wrap${desk ? " wide" : ""}`}>
      <div className="wrap-body" hidden={desk !== null}>
        <Header />
        <Bar client={api} entries={queue} onPull={pull} onChange={state.refresh} />
        <ViewSwitch view={view} onChange={next => { setView(next); if (next === "everything") setOpenedEverything(true); }} />
        {view === "day" && <NotifyControl notifier={notifier} />}
        {view === "day" && desk === null && <DayView client={api} state={state} session={session} setSession={setSession} now={now} dismissed={dismissed} onDismissMeeting={dismiss} queue={queue} onOpenDesk={slug => { setDesk({ slug, from: "day" }); }} />}
        {openedEverything && <div hidden={view !== "everything"}><EverythingView client={api} active={view === "everything" && desk === null} shares={state.view?.mirror?.balance?.areas} assistantName={state.view?.assistantName} onChange={state.refresh} onOpenDesk={slug => { setDesk({ slug, from: "everything" }); }} /></div>}
      </div>
      {desk && <DeskScreen client={api} slug={desk.slug} from={desk.from} state={state} now={now} onBack={() => { setDesk(null); }} onOpenDesk={slug => { setDesk({ ...desk, slug }); }} />}
    </main>
  );
}

function DeskScreen({ client, slug, from, state, now, onBack, onOpenDesk }: { client: DeskClient; slug: string; from: Place; state: DeskState & { refresh: () => void }; now: number; onBack: () => void; onOpenDesk: (slug: string) => void }) {
  const { t } = useI18n();
  return <Desk client={client} refresh={state.refresh} studio={state.studio} slug={slug} loading={state.view === null && state.error === null} backLabel={t(from === "day" ? "desk.back.day" : "desk.back.everything")} onBack={onBack} now={now} onOpenDesk={onOpenDesk} />;
}

export function DayView({ client, state, session, setSession, now, dismissed = [], onDismissMeeting = () => {}, queue: given, onOpenDesk }: {
  client: DeskClient;
  state: DeskState & { refresh: () => void };
  session: Session;
  setSession: (s: Session) => void;
  now: number;
  dismissed?: readonly string[];
  onDismissMeeting?: (key: string) => void;
  queue?: readonly Entry[];
  onOpenDesk?: (slug: string) => void;
}) {
  const queue = given ?? (state.view ? buildQueue(state.view, state.studio, session, now, dismissed, state.rules ?? null) : []);
  const onPull = (k: string) => { setSession(session.pin === k ? session : pin(session, k)); };
  return (
    <div className="daygrid one">
      <QueueView client={client} state={state} session={session} setSession={setSession} now={now} dismissed={dismissed} onDismissMeeting={onDismissMeeting} onOpenDesk={onOpenDesk} />
      {state.view && <aside className="rail">
        <TimelineView view={state.view} studio={state.studio} clock={clockAt(now)} queue={queue} onPull={onPull} />
        <Footer view={state.view} now={now} queue={queue} onPull={onPull} />
      </aside>}
    </div>
  );
}

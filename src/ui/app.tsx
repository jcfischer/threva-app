import { useMemo } from "react";
import { createClient, type DeskClient } from "./api/client";
import { Bar } from "./bar/bar";
import { Footer } from "./day/footer";
import { TimelineView } from "./day/timeline-view";
import { useI18n } from "./i18n";
import { QueueView } from "./queue/queue-view";
import { useDesk } from "./queue/use-desk";

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
  return (
    <main className="wrap">
      <Header />
      <Bar client={desk} onChange={state.refresh} />
      <QueueView client={desk} state={state} />
      {state.view && <TimelineView today={state.view.today} tasks={state.view.myDay?.items ?? []} />}
      {state.view && <Footer view={state.view} />}
    </main>
  );
}

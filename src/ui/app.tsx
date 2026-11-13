import { useMemo } from "react";
import { createClient, type DeskClient } from "./api/client";
import { Bar } from "./bar/bar";
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
    </main>
  );
}

import { useMemo } from "react";
import { createClient, type DeskClient } from "./api/client";
import { useI18n } from "./i18n";
import { QueueView } from "./queue/queue-view";

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
  return (
    <main className="wrap">
      <Header />
      <QueueView client={desk} />
    </main>
  );
}

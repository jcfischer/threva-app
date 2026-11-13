import { useI18n } from "./i18n";

export function App() {
  const { t } = useI18n();
  return (
    <main>
      <h1>{t("app.title")}</h1>
      <p>{t("app.tagline")}</p>
    </main>
  );
}

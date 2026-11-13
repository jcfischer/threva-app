import { createRoot } from "react-dom/client";
import { App } from "./app";
import { createI18n, I18nProvider, pickLocale } from "./i18n";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element in index.html.");

const i18n = createI18n(pickLocale(navigator.language));
document.documentElement.lang = i18n.locale;

createRoot(root).render(
  <I18nProvider value={i18n}>
    <App />
  </I18nProvider>,
);

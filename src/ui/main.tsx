import { createRoot } from "react-dom/client";
import { App } from "./app";
import { createI18n, I18nProvider, pickLocale } from "./i18n";
import { EverythingPrototype } from "./prototype-everything/prototype";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element in index.html.");

const i18n = createI18n(pickLocale(navigator.language));
document.documentElement.lang = i18n.locale;

// PROTOTYPE (threva-app#47): ?prototype=everything shows the time-lens variants instead of the app.
const prototype = new URLSearchParams(location.search).get("prototype") === "everything";

createRoot(root).render(<I18nProvider value={i18n}>{prototype ? <EverythingPrototype /> : <App />}</I18nProvider>);

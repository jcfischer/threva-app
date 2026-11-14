import { createRoot } from "react-dom/client";
import { App } from "./app";
import { createI18n, I18nProvider, pickLocale } from "./i18n";
import { StudioPrototype } from "./prototype-studio/prototype";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element in index.html.");

const i18n = createI18n(pickLocale(navigator.language));
document.documentElement.lang = i18n.locale;

// PROTOTYPE (docs/design/studio-redesign.md): ?prototype=studio shows the Studio redesign variants instead of the app.
const prototype = new URLSearchParams(location.search).get("prototype") === "studio";

createRoot(root).render(<I18nProvider value={i18n}>{prototype ? <StudioPrototype /> : <App />}</I18nProvider>);

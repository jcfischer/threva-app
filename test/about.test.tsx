import { expect, test } from "bun:test";
import type { BuildInfo } from "../src/ui/about/build-info";
import { renderToStaticMarkup } from "react-dom/server";
import { AboutPanel } from "../src/ui/about/about";
import { App, Header } from "../src/ui/app";
import { createI18n, I18nProvider, type Locale } from "../src/ui/i18n";

const full = { sourceDir: "/opt/homebrew/share/threva/src", threvaTag: "v0.3.0", cortexTag: "v1.9.2" };
const none = { sourceDir: null, threvaTag: null, cortexTag: null };

const panel = (info: BuildInfo, locale: Locale = "en") =>
  renderToStaticMarkup(<I18nProvider value={createI18n(locale)}><AboutPanel info={info} /></I18nProvider>);

test("with build values the panel links both tags and shows the source directory", () => {
  const html = panel(full);
  expect(html).toContain('href="https://github.com/jcfischer/threva-app/releases/tag/v0.3.0"');
  expect(html).toContain('href="https://github.com/the-metafactory/cortex/releases/tag/v1.9.2"');
  expect(html).toContain("<code>/opt/homebrew/share/threva/src</code>");
});

test("without build values the panel links the repositories and says the source ships with installed builds", () => {
  const html = panel(none);
  expect(html).toContain('href="https://github.com/jcfischer/threva-app"');
  expect(html).toContain('href="https://github.com/the-metafactory/cortex"');
  expect(html).toContain("source ships with installed builds");
  expect(html).not.toContain("undefined");
  expect(html).not.toContain('href=""');
});

test("a missing value falls back alone", () => {
  const html = panel({ ...full, cortexTag: null });
  expect(html).toContain("releases/tag/v0.3.0");
  expect(html).not.toContain("releases/tag/v1.9.2");
  expect(html).toContain('href="https://github.com/the-metafactory/cortex"');
  expect(html).toContain("<code>/opt/homebrew/share/threva/src</code>");
});

test("the panel is German in the German catalog", () => {
  expect(panel(none, "de")).toContain("Quelltext");
});

test("the header shows a quiet About button after the tagline", () => {
  const html = renderToStaticMarkup(<Header />);
  expect(html.indexOf("A place for the thread")).toBeLessThan(html.indexOf(">About<"));
  expect(html).toContain('class="about-toggle"');
  expect(html).not.toContain("about-panel");
});

test("the app shows the About button", () => {
  expect(renderToStaticMarkup(<App />)).toContain(">About<");
});

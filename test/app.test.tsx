import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../src/ui/app";
import { createI18n, I18nProvider, type Locale } from "../src/ui/i18n";

const shell = await Bun.file(`${import.meta.dir}/../src/ui/index.html`).text();

const render = (locale: Locale) =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <App />
    </I18nProvider>,
  );

test("renders English from the catalog by default", () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain("<h1>Threva</h1>");
  expect(html).toContain("A place for the thread of your work.");
});

test("renders German from the German catalog", () => {
  const html = render("de");
  expect(html).toContain("Ein Ort für den Faden deiner Arbeit.");
  expect(html).not.toContain("A place for the thread");
});

test("declares an English document with the product title", () => {
  expect(shell).toContain('<html lang="en">');
  expect(shell).toContain("<title>Threva</title>");
  expect(shell).toContain('type="module"');
});

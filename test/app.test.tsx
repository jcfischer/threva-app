import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../src/ui/app";

const shell = await Bun.file(`${import.meta.dir}/../src/ui/index.html`).text();

test("renders the app to a string without a DOM", () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain("<h1>Threva</h1>");
  expect(html).toContain("Ein Ort für den Faden deiner Arbeit.");
});

test("declares the German document with the product title", () => {
  expect(shell).toContain('<html lang="de">');
  expect(shell).toContain("<title>Threva</title>");
  expect(shell).toContain('type="module"');
});

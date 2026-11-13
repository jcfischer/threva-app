import { expect, test } from "bun:test";
import { createI18n, pickLocale, type Messages } from "../src/ui/i18n";
import { de } from "../src/ui/i18n/de";
import { en } from "../src/ui/i18n/en";

test("picks German for any de locale and English otherwise", () => {
  expect(pickLocale("de-CH")).toBe("de");
  expect(pickLocale("DE")).toBe("de");
  expect(pickLocale("en-US")).toBe("en");
  expect(pickLocale("fr")).toBe("en");
  expect(pickLocale(undefined)).toBe("en");
});

test("the German catalog has exactly the English keys", () => {
  expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
});

test("fills variables and formats numbers for the locale", () => {
  expect(createI18n("en").tn("queue.count", 1)).toBe("1 card");
  expect(createI18n("en").tn("queue.count", 1200)).toBe("1,200 cards");
  expect(createI18n("de").tn("queue.count", 1)).toBe("1 Karte");
  expect(createI18n("de").tn("queue.count", 3)).toBe("3 Karten");
});

test("the type checker rejects a catalog with a missing or an extra key", () => {
  // @ts-expect-error: "app.tagline" and "queue.count" are missing.
  const missing: Messages = { "app.title": "Threva" };
  const extra: Messages = {
    ...en,
    // @ts-expect-error: a key the English catalog does not have.
    "app.unknown": "x",
  };
  expect(missing).toBeDefined();
  expect(extra).toBeDefined();
});

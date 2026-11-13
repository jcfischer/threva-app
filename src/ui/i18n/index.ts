import { createContext, useContext } from "react";
import type { Messages, Plural, PluralKey, TextKey, Vars } from "./catalog";
import { de } from "./de";
import { en } from "./en";

export type { Messages, Plural, PluralKey, TextKey, Vars } from "./catalog";

export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];

const CATALOGS: Record<Locale, Messages> = { en, de };

export function pickLocale(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith("de") ? "de" : "en";
}

export interface I18n {
  readonly locale: Locale;
  t(key: TextKey, vars?: Vars): string;
  tn(key: PluralKey, count: number, vars?: Vars): string;
  time(date: Date): string;
  date(date: Date): string;
  number(value: number): string;
}

export function createI18n(locale: Locale): I18n {
  const messages = CATALOGS[locale];
  const plurals = new Intl.PluralRules(locale);
  const numbers = new Intl.NumberFormat(locale);
  const times = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const dates = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const fill = (text: string, vars: Vars = {}) =>
    text.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = vars[name];
      if (value === undefined) return whole;
      return typeof value === "number" ? numbers.format(value) : value;
    });
  return {
    locale,
    t: (key, vars) => fill(messages[key] as string, vars),
    tn: (key, count, vars) => {
      const forms = messages[key] as Plural;
      const form = forms[plurals.select(count)] ?? forms.other;
      return fill(form, { ...vars, count });
    },
    time: (d) => times.format(d),
    date: (d) => dates.format(d),
    number: (n) => numbers.format(n),
  };
}

const I18nContext = createContext<I18n>(createI18n("en"));

export const I18nProvider = I18nContext.Provider;

export function useI18n(): I18n {
  return useContext(I18nContext);
}

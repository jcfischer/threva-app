import { en } from "./en";

export type Plural = { readonly other: string } & Partial<Record<Exclude<Intl.LDMLPluralRule, "other">, string>>;

type Source = typeof en;

export type Messages = { readonly [K in keyof Source]: Source[K] extends string ? string : Plural };

export type TextKey = { [K in keyof Source]: Source[K] extends string ? K : never }[keyof Source];
export type PluralKey = Exclude<keyof Source, TextKey>;

export type Vars = Readonly<Record<string, string | number>>;

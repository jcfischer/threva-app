import { safeHref } from "@desk/safe-link";

export interface TextLink {
  from: number;
  to: number;
  href: string;
}

export type TitlePart = { text: string; href?: undefined } | { text: string; href: string };

const MARKDOWN_LABEL = String.raw`\[([^\]\n]*)\]`;
const MARKDOWN_TARGET_WITH_ONE_LEVEL_OF_PARENTHESES = String.raw`\(((?:[^()\s]|\([^()\s]*\))+)\)`;
const BARE_HTTP_OR_MESSAGE_URL = String.raw`(?:https?:\/\/|message:)[^\s<>]+`;
const MARKDOWN_LINK_OR_BARE_URL = new RegExp(`${MARKDOWN_LABEL}${MARKDOWN_TARGET_WITH_ONE_LEVEL_OF_PARENTHESES}|${BARE_HTTP_OR_MESSAGE_URL}`, "g");
const SENTENCE_PUNCTUATION_AT_END = /[.,;:!?'"\]]$/;

function endsWithUnpairedClosingParenthesis(url: string): boolean {
  return url.endsWith(")") && url.split(")").length > url.split("(").length;
}

function withoutSentenceEnd(bareUrl: string): string {
  let url = bareUrl;
  for (;;) {
    if (SENTENCE_PUNCTUATION_AT_END.test(url) || endsWithUnpairedClosingParenthesis(url)) url = url.slice(0, -1);
    else return url;
  }
}

/** The links in a text whose targets pass the safe-link rules, in order. */
export function findLinks(text: string): TextLink[] {
  const found: TextLink[] = [];
  for (const match of text.matchAll(MARKDOWN_LINK_OR_BARE_URL)) {
    const from = match.index;
    const bare = match[2] === undefined;
    const raw = bare ? withoutSentenceEnd(match[0]) : match[2]!;
    const href = safeHref(raw);
    if (href) found.push({ from, to: bare ? from + raw.length : from + match[0].length, href });
  }
  return found;
}

/** A row title split into plain text and its http and https URLs, which are the only links a title shows. */
export function titleParts(title: string): TitlePart[] {
  const parts: TitlePart[] = [];
  let at = 0;
  for (const link of findLinks(title)) {
    if (!/^https?:/i.test(link.href) || title[link.from] === "[") continue;
    if (link.from > at) parts.push({ text: title.slice(at, link.from) });
    parts.push({ text: title.slice(link.from, link.to), href: link.href });
    at = link.to;
  }
  if (at < title.length || !parts.length) parts.push({ text: title.slice(at) });
  return parts;
}

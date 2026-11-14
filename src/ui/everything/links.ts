import { safeHref } from "../api/safe-link";

export interface TextLink {
  from: number;
  to: number;
  href: string;
}

export type TitlePart = { text: string; href?: undefined } | { text: string; href: string };

// A Markdown link `[label](target)`, or a bare http, https or message: URL.
// A target may hold one level of balanced parentheses, as Wikipedia URLs do.
const LINKS = /\[([^\]\n]*)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|(?:https?:\/\/|message:)[^\s<>]+/g;
// Punctuation that ends a sentence rather than the URL it follows.
const TRAILING = /[.,;:!?'"\]]$/;

// Drops sentence punctuation after a bare URL, and a closing parenthesis only when it has no partner in the URL.
function trimBare(url: string): string {
  for (;;) {
    if (TRAILING.test(url)) url = url.slice(0, -1);
    else if (url.endsWith(")") && url.split(")").length > url.split("(").length) url = url.slice(0, -1);
    else return url;
  }
}

/** The links in a text whose targets pass the safe-link rules, in order. */
export function findLinks(text: string): TextLink[] {
  const found: TextLink[] = [];
  for (const match of text.matchAll(LINKS)) {
    const from = match.index;
    const bare = match[2] === undefined;
    const raw = bare ? trimBare(match[0]) : match[2]!;
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

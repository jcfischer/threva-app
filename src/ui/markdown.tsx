import type { ReactNode } from "react";
import { Autolink, parser, Strikethrough } from "@lezer/markdown";
import { safeHref } from "@desk/safe-link";

const markdown = parser.configure([Autolink, Strikethrough]);
type SyntaxNode = ReturnType<typeof markdown.parse>["topNode"];

const MARKS = new Set(["EmphasisMark", "CodeMark", "QuoteMark", "ListMark", "HeaderMark", "LinkMark", "StrikethroughMark", "URL", "LinkTitle", "LinkLabel", "CodeInfo"]);
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };

function entity(source: string): string {
  const name = source.slice(1, -1);
  const code = name.startsWith("#x") || name.startsWith("#X") ? Number.parseInt(name.slice(2), 16) : name.startsWith("#") ? Number.parseInt(name.slice(1), 10) : NaN;
  if (Number.isInteger(code) && code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
  return ENTITIES[name] ?? source;
}

function children(node: SyntaxNode): SyntaxNode[] {
  const list: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) list.push(child);
  return list;
}

/** Renders Markdown as React elements. Raw HTML stays text, and only links that pass safeHref become links. */
export function Markdown({ text }: { text: string }) {
  const tree = markdown.parse(text);
  const slice = (from: number, to: number) => text.slice(from, to);
  const urlOf = (node: SyntaxNode) => {
    const url = node.getChild("URL");
    return url ? slice(url.from, url.to) : undefined;
  };
  const anchor = (key: number, href: string, label: ReactNode) => <a key={key} href={href} target="_blank" rel="noreferrer">{label}</a>;
  const refKey = (label: string) => label.replace(/^\[|\]$/g, "").trim().replace(/\s+/g, " ").toLowerCase();
  // Definitions like [1]: https://… anywhere in the text, for links written as [label][1] or [label].
  const references = new Map<string, string>();
  tree.iterate({
    enter: (ref) => {
      if (ref.name !== "LinkReference") return;
      const label = ref.node.getChild("LinkLabel");
      const url = urlOf(ref.node);
      if (label && url && !references.has(refKey(slice(label.from, label.to)))) references.set(refKey(slice(label.from, label.to)), url);
      return false;
    },
  });

  function inline(node: SyntaxNode, from = node.from, to = node.to, trim = false): ReactNode[] {
    const out: ReactNode[] = [];
    let at = from;
    let lineStart = trim;
    const gap = (end: number) => {
      if (end <= at) return;
      slice(at, end).split("\n").forEach((line, index) => {
        if (index > 0) {
          out.push(<br key={`br${at}-${index}`} />);
          lineStart = true;
        }
        const shown = lineStart ? line.trimStart() : line;
        if (shown) {
          out.push(shown);
          lineStart = false;
        }
      });
    };
    for (const child of children(node)) {
      if (child.to <= from || child.from >= to) continue;
      gap(child.from);
      at = child.to;
      if (child.name === "QuoteMark" || child.name === "HeaderMark") continue;
      out.push(...inlineNode(child));
      lineStart = child.name === "HardBreak";
    }
    gap(to);
    return out;
  }

  function inlineNode(node: SyntaxNode): ReactNode[] {
    const key = node.from;
    switch (node.name) {
      case "Emphasis": return [<em key={key}>{inline(node)}</em>];
      case "StrongEmphasis": return [<strong key={key}>{inline(node)}</strong>];
      case "Strikethrough": return [<del key={key}>{inline(node)}</del>];
      case "InlineCode": {
        const marks = node.getChildren("CodeMark");
        return [<code key={key}>{slice(marks[0]?.to ?? node.from, marks[1]?.from ?? node.to).replace(/\n/g, " ")}</code>];
      }
      case "Link":
      case "Image": {
        const marks = node.getChildren("LinkMark");
        const named = node.getChild("LinkLabel");
        const reference = named && named.to - named.from > 2 ? slice(named.from, named.to) : marks.length >= 2 ? slice(marks[0]!.to, marks[1]!.from) : "";
        const href = safeHref(urlOf(node) ?? references.get(refKey(reference)));
        const label = marks.length >= 2 ? inline(node, marks[0]!.to, marks[1]!.from) : [slice(node.from, node.to)];
        return href ? [anchor(key, href, label)] : label;
      }
      case "Autolink":
      case "URL": {
        const url = node.name === "URL" ? slice(node.from, node.to) : (urlOf(node) ?? slice(node.from, node.to));
        const href = safeHref(url);
        return href ? [anchor(key, href, url)] : [slice(node.from, node.to)];
      }
      case "HardBreak": return [<br key={key} />];
      case "Escape": return [slice(node.from + 1, node.to)];
      case "Entity": return [entity(slice(node.from, node.to))];
      default: return MARKS.has(node.name) ? [] : [slice(node.from, node.to)];
    }
  }

  function code(node: SyntaxNode): string {
    const parts = node.getChildren("CodeText");
    if (!parts.length) return "";
    const body = slice(parts[0]!.from, parts[parts.length - 1]!.to);
    return node.name === "CodeBlock" ? body.replace(/\n {1,4}/g, "\n").replace(/\n$/, "") : body;
  }

  function block(node: SyntaxNode): ReactNode {
    const key = node.from;
    const heading = /^(?:ATX|Setext)Heading(\d)$/.exec(node.name);
    if (heading) {
      const level = Number(heading[1]);
      let end = node.name.startsWith("Setext") && node.lastChild ? node.lastChild.from : node.to;
      while (end > node.from && /\s/.test(text[end - 1]!)) end--;
      const content = inline(node, node.from, end, true);
      return level === 1 ? <h4 key={key}>{content}</h4> : level === 2 ? <h5 key={key}>{content}</h5> : <h6 key={key}>{content}</h6>;
    }
    switch (node.name) {
      case "Paragraph": return <p key={key}>{inline(node)}</p>;
      case "BulletList": return <ul key={key}>{children(node).map(block)}</ul>;
      case "OrderedList": {
        const first = node.firstChild?.getChild("ListMark");
        const start = first ? Number.parseInt(slice(first.from, first.to), 10) : 1;
        return <ol key={key} start={start === 1 ? undefined : start}>{children(node).map(block)}</ol>;
      }
      case "ListItem": return <li key={key}>{children(node).map(block)}</li>;
      case "Blockquote": return <blockquote key={key}>{children(node).map(block)}</blockquote>;
      case "FencedCode":
      case "CodeBlock": return <pre key={key}><code>{code(node)}</code></pre>;
      case "HorizontalRule": return <hr key={key} />;
      case "ListMark":
      case "QuoteMark":
      case "LinkReference": return null;
      default: return <p key={key}>{slice(node.from, node.to)}</p>;
    }
  }

  return <div className="md">{children(tree.topNode).map(block)}</div>;
}

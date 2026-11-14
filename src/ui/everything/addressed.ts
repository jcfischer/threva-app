import { useMemo, useRef } from "react";
import type { ChangeDesc } from "@codemirror/state";
import type { EnterLine, LineDecoration } from "./editor";

export function addressedText(line: string, name: string | null): string | null {
  const text = line.trimStart();
  if (text.startsWith("/")) return text.slice(1).trim();
  if (name && text.slice(0, name.length + 1).toLocaleLowerCase() === `${name},`.toLocaleLowerCase()) return text.slice(name.length + 1).trim();
  return null;
}

function lineRemovalRange(from: number, to: number, length: number) {
  return { from: to === length && from > 0 ? from - 1 : from, to: to < length ? to + 1 : to };
}

/** Thread addressing is shared by the rich editor and its plain Markdown fallback. */
export function useAddressedLines(name: string | null, hint: string, send: (text: string) => Promise<boolean>) {
  const pending = useRef<{ from: number; to: number; text: string } | null>(null);
  const lineDecoration = useMemo<LineDecoration>(() => ({
    matches: text => addressedText(text, name) !== null,
    className: "cm-thread-addressed",
    plainClassName: "thread-addressed",
    hint,
  }), [name, hint]);
  const onEnter = (line: EnterLine) => {
    const text = addressedText(line.text, name);
    if (text === null) return false;
    if (!text || pending.current) return true;
    pending.current = { from: line.from, to: line.to, text: line.text };
    void send(text).then(ok => {
      const sent = pending.current;
      const doc = line.read();
      if (!ok || !sent || doc === null || sent.from > sent.to || doc.slice(sent.from, sent.to) !== sent.text) return;
      // Text added at either edge belongs to the newer line and must survive the response.
      const end = doc.indexOf("\n", sent.from);
      if ((sent.from > 0 && doc[sent.from - 1] !== "\n") || (end === -1 ? doc.length : end) !== sent.to) return;
      line.remove(lineRemovalRange(sent.from, sent.to, doc.length));
    }).finally(() => { pending.current = null; });
    return true;
  };
  const onEdit = (changes: ChangeDesc) => {
    const sent = pending.current;
    if (sent) pending.current = { ...sent, from: changes.mapPos(sent.from, 1), to: changes.mapPos(sent.to, -1) };
  };
  return { lineDecoration, onEnter, onEdit };
}

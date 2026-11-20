import { useState } from "react";
import type { StudioThread } from "@desk/types";
import { useI18n } from "../i18n";
import { firstSentence } from "./cards";

export type HistoryKind = "note" | "response" | "log";

export interface HistoryBlock {
  kind: HistoryKind;
  at: string;
  text: string;
  noteId: string | null;
}

const time = (at: string): number => {
  const value = Date.parse(at);
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
};

/** One block for each note that is not a relation, each response and each log entry, oldest first. */
export function historyBlocks(thread: Pick<StudioThread, "notes" | "responses" | "log">): HistoryBlock[] {
  const blocks: HistoryBlock[] = [
    ...thread.notes
      .filter((note) => note.kind !== "relation")
      .map((note): HistoryBlock => ({ kind: "note", at: note.at, text: firstSentence(note.text), noteId: note.at })),
    ...thread.responses.map((response): HistoryBlock => ({ kind: "response", at: response.at, text: firstSentence(response.text), noteId: null })),
    ...(thread.log ?? []).map((entry): HistoryBlock => ({ kind: "log", at: entry.at ?? "", text: entry.text, noteId: null })),
  ];
  return blocks
    .map((block, index) => ({ block, index }))
    .sort((a, b) => time(a.block.at) - time(b.block.at) || a.index - b.index)
    .map(({ block }) => block);
}

const KIND_LABEL = {
  note: "desk.history.note",
  response: "desk.history.response",
  log: "desk.history.log",
} as const;

/** The topic's history along the bottom of the desk: a click on a note's block brings its card to the desk. */
export function History({ thread, onOpenNote }: { thread: Pick<StudioThread, "notes" | "responses" | "log">; onOpenNote: (id: string) => void }) {
  const { t, date, time: clock } = useI18n();
  const [shown, setShown] = useState<number | null>(null);
  const blocks = historyBlocks(thread);
  if (blocks.length === 0) return null;
  const when = (at: string): string => {
    const value = new Date(at);
    return Number.isNaN(value.getTime()) ? at : `${date(value)}, ${clock(value)}`;
  };
  const current = shown === null ? undefined : blocks[shown];
  return <div className="desk-history">
    <div className="desk-history-ends">
      <span className="faint">{t("desk.history.opened", { when: when(blocks[0].at) })}</span>
      <span className="faint">{t("desk.history.now")}</span>
    </div>
    <ul className="desk-history-strip" aria-label={t("desk.history")}>
      {blocks.map((block, index) => <li key={`${block.kind}-${block.at}-${index}`}>
        <button
          type="button"
          className={`desk-block desk-block-${block.kind}`}
          data-history={block.kind}
          aria-label={t("desk.history.block", { kind: t(KIND_LABEL[block.kind]), when: when(block.at), text: block.text })}
          onMouseEnter={() => { setShown(index); }}
          onMouseLeave={() => { setShown(null); }}
          onFocus={() => { setShown(index); }}
          onBlur={() => { setShown(null); }}
          onClick={() => { if (block.noteId !== null) onOpenNote(block.noteId); }}
        />
      </li>)}
    </ul>
    <p className="desk-history-detail" role="status">{current ? `${when(current.at)}: ${current.text}` : ""}</p>
  </div>;
}

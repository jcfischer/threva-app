import { useState } from "react";
import type { OutlineRow } from "../api/types";
import { useI18n } from "../i18n";
import { NoteEditor } from "./editor";
import { NOTE_LIMIT, NOTE_WARN, wordCount, type NoteNotice } from "./note";

export interface NotePageProps {
  row: OutlineRow;
  text: string;
  place: number | null;
  notice: NoteNotice | null;
  onType(text: string): void;
  onLeave(text: string, at: number): void;
}

/** A row's page: the row's note as Markdown above the rows inside it, with a quiet line of what the save did. */
export function NotePage({ row, text, place, notice, onType, onLeave }: NotePageProps) {
  const { t, tn } = useI18n();
  const [length, setLength] = useState(text.length);
  const [words, setWords] = useState(() => wordCount(text));
  const count = (next: string) => {
    setLength(next.length);
    setWords(wordCount(next));
  };
  const status = notice === null ? null : notice.state === "saved" ? t("note.saved") : notice.message ?? t("error.network");
  const parts = [tn("note.words", words), length > NOTE_WARN ? t("note.length", { count: length, max: NOTE_LIMIT }) : null].filter((part): part is string => part !== null);
  return <div className="note-page">
    <NoteEditor
      value={text}
      label={t("note.label", { title: row.title })}
      hint={t("note.placeholder")}
      place={place}
      onChange={next => { count(next); onType(next); }}
      onLeave={(next, at) => { count(next); onLeave(next, at); }}
    />
    <p className={`note-line${length > NOTE_WARN ? " warn" : ""}`}>
      {parts.join(" · ")}
      {status !== null && <span role="status">{parts.length ? " · " : ""}{status}</span>}
    </p>
  </div>;
}

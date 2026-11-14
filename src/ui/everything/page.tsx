import { useEffect, useState } from "react";
import type { OutlineRow } from "../api/types";
import { useI18n } from "../i18n";
import { NoteEditor } from "./editor";
import type { LiftOutcome } from "./lift";
import { NOTE_LIMIT, NOTE_WARN, wordCount, type NoteNotice } from "./note";

export interface NotePageProps {
  row: OutlineRow;
  text: string;
  place: number | null;
  notice: NoteNotice | null;
  clean?: boolean;
  onType(text: string): void;
  onLeave(text: string, at: number): void;
  onLift?(request: { page: string; from: number; to: number }): Promise<LiftOutcome>;
}

/** A row's page: the row's note as Markdown above the rows inside it, with a quiet line of what the save did. */
export function NotePage({ row, text, place, notice, clean = true, onType, onLeave, onLift }: NotePageProps) {
  const { t, tn } = useI18n();
  const [length, setLength] = useState(text.length);
  const [words, setWords] = useState(() => wordCount(text));
  const count = (next: string) => {
    setLength(next.length);
    setWords(wordCount(next));
  };
  useEffect(() => { count(text); }, [text]);
  const status = notice === null ? null : notice.state === "saved" ? t("note.saved") : notice.state === "lifted" ? t("note.lifted", { title: notice.message ?? "" }) : notice.message ?? t("error.network");
  const parts = [tn("note.words", words), length > NOTE_WARN ? t("note.length", { count: length, max: NOTE_LIMIT }) : null].filter((part): part is string => part !== null);
  return <div className="note-page">
    <NoteEditor
      value={text}
      label={t("note.label", { title: row.title })}
      hint={t("note.placeholder")}
      place={place}
      clean={clean}
      onLift={onLift}
      liftLabel={t("lift.act")}
      liftKeys={/Mac|iPhone|iPad/.test(typeof navigator === "undefined" ? "" : navigator.platform) ? t("lift.keysMac") : t("lift.keysOther")}
      onChange={next => { count(next); onType(next); }}
      onLeave={(next, at) => { count(next); onLeave(next, at); }}
    />
    <p className={`note-line${length > NOTE_WARN ? " warn" : ""}`}>
      {parts.join(" · ")}
      {status !== null && <span role="status">{parts.length ? " · " : ""}{status}</span>}
    </p>
  </div>;
}

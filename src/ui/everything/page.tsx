import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeDesc } from "@codemirror/state";
import { newRequestId, type DeskClient } from "../api/client";
import type { OutlineRow } from "../api/types";
import { useI18n } from "../i18n";
import { addressedText, lineRemovalRange } from "./addressed";
import { askAssistant, lineAbove, localDate, pageAfterKeep, pageAfterReplace, type AskKind, AssistantNotes, type OpenNote } from "./assistant";
import { NoteEditor, type EnterLine, type LineDecoration, type PageController } from "./editor";
import { AssistantMargin } from "./margin";
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
  client?: Pick<DeskClient, "post">;
  notes?: AssistantNotes;
  assistantName?: string;
}

interface Sent {
  from: number;
  leading: boolean;
  text: string;
}

/** A row's page: the row's note as Markdown above the rows inside it, with a quiet line of what the save did. */
export function NotePage({ row, text, place, notice, clean = true, onType, onLeave, onLift, client, notes: store, assistantName }: NotePageProps) {
  const { t, tn } = useI18n();
  const [length, setLength] = useState(text.length);
  const [words, setWords] = useState(() => wordCount(text));
  const count = (next: string) => {
    setLength(next.length);
    setWords(wordCount(next));
  };
  useEffect(() => { count(text); }, [text]);
  const name = assistantName || t("studio.assistant");
  const [open, setOpen] = useState<OpenNote[]>(() => store?.list(row.id) ?? []);
  const [waiting, setWaiting] = useState<{ id: string; passage: string | null }[]>([]);
  const [tops, setTops] = useState<Record<string, number | null>>({});
  const [asked, setAsked] = useState<string | null>(null);
  const controller = useRef<PageController | null>(null);
  const mounted = useRef(true);
  const sent = useRef(new Set<Sent>());
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!store) return;
    setOpen(store.list(row.id));
    return AssistantNotes.subscribe(changed => {
      if (changed === row.id) setOpen(store.list(row.id));
    });
  }, [store, row.id]);
  const passages = useMemo(() => [...open, ...waiting].flatMap(item => item.passage ? [{ id: item.id, text: item.passage }] : []), [open, waiting]);
  // The answer is stored whether or not this page is still open, so leaving the row does not lose it.
  const send = async (kind: AskKind, question: string | undefined, passage: string | null): Promise<boolean> => {
    if (!client || !store) return false;
    const id = newRequestId();
    setAsked(null);
    setWaiting(previous => [...previous, { id, passage }]);
    try {
      const outcome = await askAssistant({ client, row: row.id, kind, question, passage, requestId: id });
      if (!outcome.ok) {
        if (mounted.current) setAsked(outcome.message ?? t("error.network"));
        return false;
      }
      const stored = store.add(row.id, { id, kind, question: question ?? "", passage, reply: outcome.reply, ...(outcome.replacement === undefined ? {} : { replacement: outcome.replacement }), at: new Date().toISOString() });
      if (!stored) {
        if (mounted.current) setAsked(t("assist.notStored"));
        return false;
      }
      return true;
    } finally {
      if (mounted.current) setWaiting(previous => previous.filter(item => item.id !== id));
    }
  };
  const lineDecoration = useMemo<LineDecoration>(() => ({
    matches: line => addressedText(line, assistantName ?? null) !== null,
    className: "cm-thread-addressed",
    plainClassName: "thread-addressed",
    hint: t("assist.enter", { name }),
  }), [assistantName, name, t]);
  const onEnter = (line: EnterLine) => {
    const question = addressedText(line.text, assistantName ?? null);
    if (question === null) return false;
    if (!question || !client) return true;
    const doc = line.read();
    if (doc === null) return true;
    const passage = lineAbove(doc, line.from);
    const range = lineRemovalRange(line.from, line.to, doc.length);
    line.remove(range);
    const record: Sent = { from: range.from, leading: range.from < line.from, text: line.text };
    sent.current.add(record);
    void send("answer", question, passage).then(ok => {
      sent.current.delete(record);
      if (ok) return;
      try {
        line.insert(record.from, record.leading ? `\n${record.text}` : `${record.text}\n`);
      } catch {}
    });
    return true;
  };
  const onEdit = (changes: ChangeDesc) => {
    for (const record of sent.current) record.from = changes.mapPos(record.from, -1);
  };
  const forget = (note: OpenNote) => {
    store?.remove(row.id, note.id);
    setOpen(store?.list(row.id) ?? []);
  };
  const keep = (note: OpenNote) => {
    if (controller.current?.apply(page => pageAfterKeep(page, note, name, localDate(new Date())))) forget(note);
  };
  const replace = (note: OpenNote) => {
    if (controller.current?.apply(page => pageAfterReplace(page, note))) forget(note);
  };
  const status = notice === null ? null : notice.state === "saved" ? t("note.saved") : notice.state === "lifted" ? t("note.lifted", { title: notice.message ?? "" }) : notice.message ?? t("error.network");
  const parts = [tn("note.words", words), length > NOTE_WARN ? t("note.length", { count: length, max: NOTE_LIMIT }) : null].filter((part): part is string => part !== null);
  const assisted = !!client && !!store;
  return <div className="note-page">
    <div className={`assist-layout${open.length || waiting.length ? " has-notes" : ""}`}>
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
      {...(assisted ? { lineDecoration, onEnter, onEdit, passages, onPassages: setTops, onAsk: (kind: AskKind, passage: string) => { void send(kind, kind === "answer" ? t("assist.standing") : undefined, passage); }, askLabel: t("assist.ask"), shortenLabel: t("assist.shorten"), assistantName: name, controller } : {})}
    />
    {assisted && (open.length > 0 || waiting.length > 0) && <AssistantMargin notes={open} waiting={waiting} tops={tops} page={text} name={name} onKeep={keep} onReplace={replace} onDismiss={forget} />}
    </div>
    {asked !== null && <p role="alert" className="assist-error">{asked}</p>}
    <p className={`note-line${length > NOTE_WARN ? " warn" : ""}`}>
      {parts.join(" · ")}
      {status !== null && <span role="status">{parts.length ? " · " : ""}{status}</span>}
    </p>
  </div>;
}

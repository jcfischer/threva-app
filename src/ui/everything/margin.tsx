import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { findPassage, layoutNotes, type OpenNote } from "./assistant";
import type { StudioNote } from "../api/types";
import { useI18n, type TextKey } from "../i18n";
import { useStudioAct } from "../studio/act";
import { ErrorLine } from "../cards/parts";

const KINDS: Record<StudioNote["kind"], TextKey> = {
  note: "studio.kind.note", stand: "studio.kind.stand", idea: "studio.kind.idea", relation: "thread.kind.relation",
};

export function ThreadDate({ at }: { at: string }) {
  const { date, time } = useI18n();
  const value = new Date(at);
  return <time dateTime={at}>{Number.isNaN(value.getTime()) ? at : `${date(value)}, ${time(value)}`}</time>;
}

function MarginNote({ note, slug, name, writable }: { note: StudioNote; slug: string; name: string; writable: boolean }) {
  const { t } = useI18n();
  const { busy, error, run } = useStudioAct();
  return <div className="thread-margin-note">
    <span className="eyebrow">{name} · <ThreadDate at={note.at} /> · {t(KINDS[note.kind])}</span>
    <p>{note.text}</p>
    {note.because && <p className="faint">{t("studio.because", { text: note.because })}</p>}
    {writable && <div className="row">
      <button type="button" className="btn pri" disabled={busy} onClick={() => { void run({ act: "keep", thread: slug, note: note.at }); }}>{t("studio.keep")}</button>
      <button type="button" className="btn quiet" disabled={busy} onClick={() => { void run({ act: "dismiss", thread: slug, note: note.at }); }}>{t("studio.dismiss")}</button>
      <ErrorLine error={error} />
    </div>}
  </div>;
}

export function Margin({ notes, slug, name, writable }: { notes: readonly StudioNote[]; slug: string; name: string; writable: boolean }) {
  const { t } = useI18n();
  return <aside className="thread-margin" aria-label={t("thread.margin", { name })}>
    {notes.map(note => <MarginNote key={note.at} note={note} slug={slug} name={name} writable={writable} />)}
  </aside>;
}

interface AssistantMarginProps {
  notes: readonly OpenNote[];
  waiting: readonly { id: string; passage: string | null }[];
  tops: Readonly<Record<string, number | null>>;
  page: string;
  name: string;
  onKeep(note: OpenNote): void;
  onReplace(note: OpenNote): void;
  onDismiss(note: OpenNote): void;
}

/** The assistant's open notes beside the page, each at the height of its passage. The buttons follow the editor in the tab order. */
export function AssistantMargin({ notes, waiting, tops, page, name, onKeep, onReplace, onDismiss }: AssistantMarginProps) {
  const { t, date } = useI18n();
  const items = [...notes.map(note => ({ id: note.id, passage: note.passage })), ...waiting];
  const nodes = useRef(new Map<string, HTMLElement>());
  const [heights, setHeights] = useState<Record<string, number>>({});
  const measure = () => {
    const next: Record<string, number> = {};
    for (const [id, node] of nodes.current) next[id] = node.getBoundingClientRect().height;
    setHeights(previous => {
      const keys = Object.keys(next);
      return keys.length === Object.keys(previous).length && keys.every(key => previous[key] === next[key]) ? previous : next;
    });
  };
  useLayoutEffect(measure);
  const { tops: placed, bottom } = layoutNotes(items.map(item => ({ id: item.id, top: tops[item.id] ?? null, height: heights[item.id] ?? 0 })));
  const hold = (id: string) => (node: HTMLElement | null) => { if (node) nodes.current.set(id, node); else nodes.current.delete(id); };
  return <aside className="assist-margin" aria-label={t("assist.margin", { name })} style={{ "--margin-height": `${bottom}px` } as CSSProperties}>
    {waiting.map(item => <div key={item.id} ref={hold(item.id)} className="assist-note assist-waiting" role="status" style={{ "--note-top": `${placed[item.id] ?? 0}px` } as CSSProperties}>
      <span className="eyebrow">{name}</span>
      <p>{t("assist.waiting", { name })}</p>
    </div>)}
    {notes.map(note => {
      const replaceable = note.replacement !== undefined && findPassage(page, note.passage) !== null;
      return <div key={note.id} ref={hold(note.id)} className="assist-note" style={{ "--note-top": `${placed[note.id] ?? 0}px` } as CSSProperties}>
        <span className="eyebrow">{name} · {date(new Date(note.at))}</span>
        {note.replacement !== undefined ? <>
          <p className="assist-old"><span className="faint">{t("assist.old")}</span> {note.passage}</p>
          <p className="assist-new"><span className="faint">{t("assist.new")}</span> {note.replacement}</p>
          {note.reply && <p>{note.reply}</p>}
        </> : <p>{note.reply}</p>}
        <div className="row">
          {note.replacement !== undefined
            ? <button type="button" className="btn pri" disabled={!replaceable} onClick={() => onReplace(note)}>{t("assist.replace")}</button>
            : <button type="button" className="btn pri" onClick={() => onKeep(note)}>{t("assist.keep")}</button>}
          <button type="button" className="btn quiet" onClick={() => onDismiss(note)}>{t("assist.dismiss")}</button>
        </div>
        {note.replacement !== undefined && !replaceable && <p className="faint">{t("assist.gone")}</p>}
      </div>;
    })}
  </aside>;
}

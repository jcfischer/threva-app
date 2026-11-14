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

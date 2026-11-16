import { useEffect, useId, useRef, useState } from "react";
import type { OutlineRow } from "../api/types";
import { useI18n } from "../i18n";
import { draftOf, isChanged, NEW_REPEAT, type RepeatDraft, type RepeatMode, type RepeatUnit, type TimeDraft } from "./time-edit";

export type SaveTime = (draft: TimeDraft) => Promise<string | null>;

const UNITS: readonly RepeatUnit[] = ["day", "week", "month"];
const MODES: readonly RepeatMode[] = ["calendar", "completion"];
const WEEK: readonly number[] = [1, 2, 3, 4, 5, 6, 0];
const UNIT_KEYS = { day: "time.unitDays", week: "time.unitWeeks", month: "time.unitMonths" } as const;
const MODE_KEYS = { calendar: "time.mode.calendar", completion: "time.mode.completion" } as const;

export function TimeFields({ draft, disabled, onDraft }: { draft: TimeDraft; disabled: boolean; onDraft: (draft: TimeDraft) => void }) {
  const { t, tn, locale } = useI18n();
  const { repeat } = draft;
  const setRepeat = (next: RepeatDraft | null) => { onDraft({ ...draft, repeat: next }); };
  const dayName = (day: number) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 15 + day)));
  return <div className="time-fields">
    <label>{t("time.start")}<input type="date" value={draft.start} disabled={disabled} onInput={event => { onDraft({ ...draft, start: event.currentTarget.value }); }} /></label>
    <label>{t("time.away")}<input type="date" value={draft.away} disabled={disabled} onInput={event => { onDraft({ ...draft, away: event.currentTarget.value }); }} /></label>
    <label>{t("time.repeat")}<select value={repeat?.unit ?? ""} disabled={disabled} onChange={event => {
      const unit = event.target.value as RepeatUnit | "";
      setRepeat(unit ? { ...(repeat ?? NEW_REPEAT), unit, weekdays: unit === "week" ? repeat?.weekdays ?? [] : [] } : null);
    }}>
      <option value="">{t("time.repeat.none")}</option>
      {UNITS.map(unit => <option key={unit} value={unit}>{t(`time.repeat.${unit}`)}</option>)}
    </select></label>
    {repeat && <>
      <label>{t("time.every")}<input type="number" min={1} step={1} value={Number.isFinite(repeat.interval) ? repeat.interval : ""} disabled={disabled} onInput={event => { setRepeat({ ...repeat, interval: event.currentTarget.value === "" ? Number.NaN : Number(event.currentTarget.value) }); }} /></label>
      <span className="faint">{tn(UNIT_KEYS[repeat.unit], Number.isFinite(repeat.interval) ? repeat.interval : 1)}</span>
      {repeat.unit === "week" && <fieldset className="time-days" disabled={disabled}>
        <legend>{t("time.weekdays")}</legend>
        {WEEK.map(day => <label key={day}><input type="checkbox" checked={repeat.weekdays.includes(day)} onChange={event => { setRepeat({ ...repeat, weekdays: event.target.checked ? [...repeat.weekdays, day] : repeat.weekdays.filter(other => other !== day) }); }} />{dayName(day)}</label>)}
      </fieldset>}
      <label>{t("time.mode")}<select value={repeat.mode} disabled={disabled} onChange={event => { setRepeat({ ...repeat, mode: event.target.value as RepeatMode }); }}>
        {MODES.map(mode => <option key={mode} value={mode}>{t(MODE_KEYS[mode])}</option>)}
      </select></label>
    </>}
  </div>;
}

const valid = (draft: TimeDraft) => !draft.repeat || (Number.isInteger(draft.repeat.interval) && draft.repeat.interval >= 1);

export function TimeForm({ row, onSave, onDone, onCancel }: { row: OutlineRow; onSave: SaveTime; onDone?: () => void; onCancel?: () => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => draftOf(row));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const changed = isChanged(row, draft);
  const save = async () => {
    setBusy(true);
    setError(null);
    const message = await onSave(draft);
    if (!alive.current) return;
    setBusy(false);
    if (message === null) onDone?.();
    else setError(message);
  };
  return <form className="time-form" onSubmit={event => { event.preventDefault(); if (changed && valid(draft) && !busy) void save(); }}>
    <TimeFields draft={draft} disabled={busy} onDraft={next => { setDraft(next); setError(null); }} />
    {error && <p className="faint time-error" role="alert">{error}</p>}
    <div className="row">
      <button type="submit" className="btn pri" disabled={busy || !changed || !valid(draft)}>{t("time.save")}</button>
      {onCancel && <button type="button" className="btn quiet" disabled={busy} onClick={onCancel}>{t("time.cancel")}</button>}
    </div>
  </form>;
}

/** The page's fields for time, next to its other details. */
export function TimeSection({ row, onSave }: { row: OutlineRow; onSave: SaveTime }) {
  const { t } = useI18n();
  const id = useId();
  return <section className="time-section" aria-labelledby={id}>
    <h3 id={id}>{t("time.section")}</h3>
    <TimeForm row={row} onSave={onSave} />
  </section>;
}

/** The margin time of a row; clicking it opens the three fields. Escape and a click outside close it without saving. */
export function TimeMargin({ row, margin, className, onSave }: { row: OutlineRow; margin: string; className: string; onSave: SaveTime }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return <span className="time-margin" ref={wrap}>
    <button type="button" ref={trigger} className={`linkq ${margin ? className : "faint"}`} aria-expanded={open} aria-controls={open ? id : undefined} aria-label={t("time.change", { title: row.title })} onClick={() => { setOpen(previous => !previous); }}>{margin || t("time.set")}</button>
    {open && <div className="time-popover" id={id} role="dialog" aria-label={t("time.dialog", { title: row.title })}>
      <TimeForm row={row} onSave={onSave} onDone={() => { setOpen(false); }} onCancel={() => { setOpen(false); }} />
    </div>}
  </span>;
}

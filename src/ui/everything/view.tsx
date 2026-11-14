import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { DeskClient } from "../api/client";
import type { AreaShare, MyDayOutline, OutlineCommand, OutlineRow } from "../api/types";
import { useI18n } from "../i18n";
import { destinations, dropMove, moveTo, pathTo, stepMove, type Move } from "./moves";
import { relativeDay, rowCounts, rowState, rowTime } from "./time";

export function EverythingView({ client, active = true, initialDay = null, shares = [], onChange = () => {} }: {
  client: DeskClient;
  active?: boolean;
  initialDay?: MyDayOutline | null;
  shares?: readonly AreaShare[];
  onChange?: () => void;
}) {
  const i18n = useI18n();
  const { t, tn } = i18n;
  const [day, setDay] = useState(initialDay);
  const [at, setAt] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const readVersion = useRef(0);
  const dragging = useRef<{ id: string; day: MyDayOutline } | null>(null);
  const [drop, setDrop] = useState<{ id: string; zone: "before" | "after" | "into" } | null>(null);

  useEffect(() => {
    if (!active || initialDay || writing.current) return;
    let live = true;
    const version = ++readVersion.current;
    void client.myDay().then(result => {
      if (!live || version !== readVersion.current) return;
      if (result.ok) { setDay(result.data); setError(null); }
      else setError(result.message ?? t("error.network"));
    });
    return () => { live = false; };
  }, [active, client, initialDay, t]);

  const change = async (snapshot: MyDayOutline, command: OutlineCommand): Promise<boolean> => {
    if (writing.current) return false;
    writing.current = true;
    ++readVersion.current;
    setBusy(true);
    setError(null);
    try {
      const result = await client.changeOutline(snapshot.date, command);
      if (result.ok) {
        setDay(result.data.view);
        onChange();
        return true;
      }
      setError(result.message ?? t("error.network"));
      const latest = await client.myDay();
      if (latest.ok) setDay(latest.data);
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };

  const retry = async () => {
    if (writing.current) return;
    const version = ++readVersion.current;
    const result = await client.myDay();
    if (version !== readVersion.current) return;
    if (result.ok) { setDay(result.data); setError(null); }
    else setError(result.message ?? t("error.network"));
  };

  if (!day) return <section aria-label={t("everything.label")}><p role={error ? "alert" : "status"}>{error ?? t("everything.loading")}</p>{error && <button type="button" className="btn" onClick={() => { void retry(); }}>{t("everything.reload")}</button>}</section>;
  const root = day.outline;
  const path = (at && pathTo(root, at)) || [root];
  const current = path.at(-1)!;
  const parents = path.slice(0, -1);
  const isArea = (id: string) => root.children.some(row => row.id === id);
  const draft = drafts[current.id] ?? "";
  const share = shares.find(area => area.areaId === current.id);
  const move = (id: string, target: Move | null, snapshot = day) => {
    if (target) void change(snapshot, { op: "outline-move", revision: snapshot.revision, id, ...target });
  };
  const dropOn = (event: DragEvent, row: OutlineRow, ancestor = false, commit = false) => {
    event.stopPropagation();
    const source = dragging.current;
    if (!source || busy) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientY - rect.top) / (rect.height || 1);
    const zone = ancestor || isArea(row.id) ? "into" : fraction < 0.28 ? "before" : fraction > 0.72 ? "after" : "into";
    const target = dropMove(source.day.outline, source.id, row.id, zone);
    if (!target) { setDrop(null); return; }
    event.preventDefault();
    if (commit) {
      move(source.id, target, source.day);
      dragging.current = null;
      setDrop(null);
    } else {
      event.dataTransfer.dropEffect = "move";
      setDrop(previous => previous?.id === row.id && previous.zone === zone ? previous : { id: row.id, zone });
    }
  };
  const summary = (row: OutlineRow) => {
    const counts = row.children.length ? rowCounts(row, day.date) : { open: 0, later: 0, back: undefined };
    return <span className="faint">{counts.open ? tn("everything.openCount", counts.open) : t("everything.nothingOpen")}{counts.later > 0 && ` · ${counts.back ? tn("everything.laterBack", counts.later, { date: relativeDay(counts.back, day.date, i18n) }) : tn("everything.laterCount", counts.later)}`}</span>;
  };
  const line = (row: OutlineRow) => {
    const area = isArea(row.id);
    const time = rowTime(row, day.date, i18n);
    const options = area ? [] : destinations(root, row.id);
    return <div key={row.id} className={`vrow outline-row${!area && time.state !== "open" ? " outline-grey" : ""}`} data-row={row.id} data-zone={drop?.id === row.id ? drop.zone : undefined}
      draggable={!area && !busy}
      onDragStart={event => { dragging.current = { id: row.id, day }; event.dataTransfer.setData("text/plain", row.id); event.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={() => { dragging.current = null; setDrop(null); }}
      onDragOver={event => dropOn(event, row)} onDrop={event => dropOn(event, row, false, true)}>
      {area ? <span /> : <details className="outline-menu">
        <summary className="hd" aria-label={t("everything.moveRow", { title: row.title })}>⠿</summary>
        <div className="outline-menu-body">
          {(["up", "down", "out"] as const).map(direction => <button type="button" className="btn quiet" key={direction} disabled={busy || !stepMove(root, row.id, direction)} onClick={() => move(row.id, stepMove(root, row.id, direction))}>{t(`everything.${direction}`)}</button>)}
          <label>{t("everything.into")}<select disabled={busy} value="" onChange={event => {
            const target = pathTo(root, event.target.value)?.at(-1);
            if (target) move(row.id, moveTo(root, row.id, target.id, target.children.length));
          }}><option value="">{t("everything.chooseParent")}</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        </div>
      </details>}
      <button type="button" className="linkq outline-title" onClick={() => setAt(row.id)}>{row.title}</button>
      {area || row.children.length ? summary(row) : <span className={`outline-margin ${time.warning ? "outline-warning" : "faint"}`}>{time.margin}</span>}
      {!area && <button type="button" className="btn quiet" disabled={busy} onClick={() => { void change(day, { op: row.done ? "outline-reopen" : "outline-complete", revision: day.revision, id: row.id, confirm: true }); }}>{t(row.done ? "everything.reopen" : "everything.done")}</button>}
    </div>;
  };
  const done = current.children.filter(row => !isArea(row.id) && rowState(row, day.date).state === "done");
  const open = current.children.filter(row => !done.includes(row));
  const body = <div className="cur">
    <h2>{current.title}</h2>
    {isArea(current.id) && <div className="stack">
      <span className="faint">{t("everything.importance", { value: current.weight })}</span>
      {share ? <><div className="balbar" aria-hidden="true"><i style={{ width: `${Math.round(share.actualShare * 100)}%` }} /><b style={{ left: `${Math.round(share.targetShare * 100)}%` }} /></div><span className="faint">{t("everything.share", { actual: Math.round(share.actualShare * 100), target: Math.round(share.targetShare * 100) })}</span></> : <span className="faint">{t("everything.shareUnavailable")}</span>}
    </div>}
    <div>{open.map(line)}{!open.length && <p className="muted">{t("everything.empty")}</p>}</div>
    {done.length > 0 && <details className="outline-done"><summary>{tn("everything.doneCount", done.length)}</summary>{done.map(line)}</details>}
    {current.id !== root.id && <form className="outline-add" onSubmit={event => {
      event.preventDefault();
      const title = draft.trim();
      const parent = current.id;
      if (title) void change(day, { op: "outline-add", revision: day.revision, parent, title }).then(saved => {
        if (saved) setDrafts(previous => ({ ...previous, [parent]: "" }));
      });
    }}>
      <label>{t("everything.addTo", { title: current.title })}<input type="text" maxLength={300} value={draft} disabled={busy} placeholder={t("everything.addPlaceholder")} onInput={event => { const text = event.currentTarget.value; setDrafts(previous => ({ ...previous, [current.id]: text })); }} /></label>
      <button type="submit" className="btn" disabled={busy || !draft.trim()}>{t("everything.add")}</button>
    </form>}
    {current.id !== root.id && !isArea(current.id) && <button type="button" className="btn quiet" disabled={busy} onClick={() => { void change(day, { op: current.done ? "outline-reopen" : "outline-complete", revision: day.revision, id: current.id, confirm: true }); }}>{t(current.done ? "everything.reopen" : "everything.done")}</button>}
  </div>;
  return <section className="everything" aria-label={t("everything.label")} aria-busy={busy}>
    {error && <div role="alert"><p>{error}</p><button type="button" className="btn" disabled={busy} onClick={() => { void retry(); }}>{t("everything.reload")}</button></div>}
    {parents.reduceRight<ReactNode>((inner, parent) => <div className="anc" key={parent.id}>
      <button type="button" className="anch" data-zone={drop?.id === parent.id ? drop.zone : undefined} onClick={() => setAt(parent.id)} onDragOver={event => dropOn(event, parent, true)} onDrop={event => dropOn(event, parent, true, true)}>‹ {parent.title}</button>
      {inner}
    </div>, body)}
  </section>;
}

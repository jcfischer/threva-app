// PROTOTYPE for threva-app#47: three variants of "time as a lens on the outline",
// switchable via ?prototype=everything&variant=A|B|C. Throwaway. Writes are stubs in memory.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Header } from "../app";
import { between, complete, counts, day, find, fixture, leaves, localToday, nextOccurrence, patch, pathTo, rhythm, shift, timeOf, type Lens, type Row } from "./data";

const VARIANTS = [
  ["A", "Margin and switch"],
  ["B", "Bands inside each project"],
  ["C", "Time rail"],
  ["D", "Drill in, fold Later and Done"],
  ["E", "Drill in, Later stays in place in grey"],
] as const;
type Key = (typeof VARIANTS)[number][0];

const CSS = `
.px-switch{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:#111;color:#fff;border-radius:99px;padding:6px 10px;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,.35);z-index:50}
.px-switch button{background:#333;color:#fff;border:0;border-radius:99px;width:28px;height:28px;cursor:pointer}
.px-state{font-family:var(--mono);font-size:12px;color:var(--faint);border:1px dashed var(--line);border-radius:8px;padding:6px 10px}
.px-late{color:var(--wait);font-weight:600}
.px-acts{display:flex;gap:4px;align-items:center}
.px-band{margin:2px 0 6px 0}
.px-band summary{cursor:pointer;font-size:13px;color:var(--faint);padding:4px 0}
.px-proj{border-left:2px solid var(--line);padding-left:14px;margin:6px 0 14px}
.px-rail{display:grid;grid-template-columns:minmax(220px,340px) repeat(22,minmax(22px,1fr));align-items:center;font-size:13px;overflow-x:auto}
.px-rail>div{min-height:28px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--line)}
.px-rail .t{justify-content:flex-start;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px}
.px-rail .h{font-size:11px;color:var(--faint);flex-direction:column;line-height:1.1}
.px-rail .we{background:var(--sunk)}
.px-rail .td{box-shadow:inset 2px 0 0 var(--accent)}
.px-rail .away{background:repeating-linear-gradient(135deg,transparent 0 4px,var(--line) 4px 5px)}
.px-dot{width:11px;height:11px;border-radius:99px;display:inline-block}
.px-dot.due{background:var(--accent)}
.px-dot.late{background:var(--wait)}
.px-dot.did{background:var(--faint)}
.px-dot.next{border:2px solid var(--accent)}
.px-dot.miss{border:2px dashed var(--wait)}
.px-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--faint);align-items:center}
.px-legend span{display:inline-flex;gap:5px;align-items:center}
`;

interface Props {
  root: Row;
  today: string;
  act: (id: string, kind: "done" | "later" | "reopen") => void;
  report: (line: string) => void;
}

function Margin({ row, today }: { row: Row; today: string }) {
  const t = timeOf(row, today);
  return (
    <span className={t.late ? "px-late" : "faint"}>
      {t.margin}
      {row.who === "routine" ? " · an agent does this" : ""}
    </span>
  );
}

function Acts({ row, today, act }: { row: Row; today: string; act: Props["act"] }) {
  const lens = timeOf(row, today).lens;
  if (row.who === "routine") return <span className="pill calm">routine</span>;
  if (lens !== "now")
    return (
      <span className="px-acts">
        <button type="button" className="btn quiet" onClick={() => act(row.id, "reopen")}>
          Bring back
        </button>
      </span>
    );
  return (
    <span className="px-acts">
      <button type="button" className="btn" onClick={() => act(row.id, "done")}>
        Done
      </button>
      <button type="button" className="btn quiet" onClick={() => act(row.id, "later")}>
        Later
      </button>
    </span>
  );
}

function Balance({ area, total }: { area: Row; total: number }) {
  const want = Math.round((area.weight / total) * 100);
  return (
    <div className="stack">
      <div className="balbar">
        <i style={{ width: `${area.got ?? 0}%` }} />
        <b style={{ left: `${want}%` }} />
      </div>
      <span className="faint">
        {area.got ?? 0}% of your time this week. The mark is the {want}% you want.
      </span>
    </div>
  );
}

// A: the prototype's drill-in outline. Time is text in the margin, and one switch filters the rows.
function VariantA({ root, today, act, report }: Props) {
  const [at, setAt] = useState(root.id);
  const [lens, setLens] = useState<Lens | "all">("all");
  const cur = find(root, at) ?? root;
  const trail = (pathTo(root, cur.id) ?? [root]).slice(0, -1);
  const all = counts(root, today);
  const shows = (row: Row) => lens === "all" || (row.children.length ? counts(row, today)[lens] > 0 : timeOf(row, today).lens === lens);
  const kids = cur.children.filter(shows);
  useEffect(() => report(`A · at "${cur.title}" · lens ${lens} · ${kids.length} of ${cur.children.length} rows shown`), [cur.title, lens, kids.length, cur.children.length, report]);
  const total = root.children.reduce((s, a) => s + a.weight, 0) || 1;
  const body = (
    <div className="cur">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{cur.title}</h2>
        {cur.focusMonth && <span className="pill think">focus this month</span>}
      </div>
      {trail.length === 1 && <Balance area={cur} total={total} />}
      <div>
        {kids.map((row) => {
          const c = counts(row, today);
          return (
            <div className="vrow" key={row.id}>
              {row.children.length ? (
                <button type="button" className="linkq" onClick={() => setAt(row.id)}>
                  {row.title}
                </button>
              ) : (
                <span className="linkq">{row.title}</span>
              )}
              {row.children.length ? (
                <span className="faint">
                  {c.now} now · {c.later} later · {c.done} done
                </span>
              ) : (
                <Margin row={row} today={today} />
              )}
              {row.children.length ? (
                <button type="button" className="btn quiet" onClick={() => setAt(row.id)}>
                  ›
                </button>
              ) : (
                <Acts row={row} today={today} act={act} />
              )}
            </div>
          );
        })}
        {kids.length === 0 && <p className="muted">Nothing here for this time.</p>}
      </div>
    </div>
  );
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="faint">Show</span>
        <div className="seg" role="tablist" aria-label="Time">
          {(
            [
              ["all", `All · ${all.now + all.later + all.done}`],
              ["now", `Now · ${all.now}`],
              ["later", `Later · ${all.later}`],
              ["done", `Done · ${all.done}`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={lens === k} onClick={() => setLens(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {trail.reduceRight<ReactNode>(
        (inner, row) => (
          <div className="anc">
            <button type="button" className="anch" onClick={() => setAt(row.id)}>
              ‹ {row.title}
            </button>
            {inner}
          </div>
        ),
        body,
      )}
    </>
  );
}

// B: no switch and no drill-in. The whole outline on one page; inside each project the rows
// are grouped by time, with Later and Done folded.
function VariantB({ root, today, act, report }: Props) {
  const total = root.children.reduce((s, a) => s + a.weight, 0) || 1;
  useEffect(() => report(`B · whole outline · ${leaves(root).length} rows · Later and Done folded per project`), [root, report]);
  const line = (row: Row) => (
    <div className="vrow" key={row.id}>
      <span className="linkq">{row.title}</span>
      <Margin row={row} today={today} />
      <Acts row={row} today={today} act={act} />
    </div>
  );
  const project = (row: Row): ReactNode => {
    if (!row.children.length) return line(row);
    const own = row.children.filter((c) => !c.children.length);
    const by = (l: Lens) => own.filter((c) => timeOf(c, today).lens === l);
    const later = by("later").sort((a, b) => (timeOf(a, today).back ?? "").localeCompare(timeOf(b, today).back ?? ""));
    return (
      <div className="px-proj" key={row.id}>
        <div className="row">
          <h3 style={{ margin: 0 }}>{row.title}</h3>
          {row.focusMonth && <span className="pill think">focus this month</span>}
        </div>
        {by("now").map(line)}
        {by("now").length === 0 && <p className="muted" style={{ margin: "6px 0" }}>Nothing needs you here now.</p>}
        {later.length > 0 && (
          <details className="px-band">
            <summary>
              Later · {later.length} · next back {day(timeOf(later[0]!, today).back ?? today, today)}
            </summary>
            {later.map(line)}
          </details>
        )}
        {by("done").length > 0 && (
          <details className="px-band">
            <summary>Done · {by("done").length}</summary>
            {by("done").map(line)}
          </details>
        )}
        {row.children.filter((c) => c.children.length).map(project)}
      </div>
    );
  };
  return (
    <>
      {root.children.map((area) => (
        <div className="cur" key={area.id}>
          <h2>{area.title}</h2>
          <Balance area={area} total={total} />
          <div>{area.children.map(project)}</div>
        </div>
      ))}
    </>
  );
}

// D: A's drill-in and margin without the switch. At the level you are in, rows that need you
// keep their outline order, and the Later and Done rows fold below them as in B.
function VariantD({ root, today, act, report, inPlace = false }: Props & { inPlace?: boolean }) {
  const [at, setAt] = useState(root.id);
  const cur = find(root, at) ?? root;
  const trail = (pathTo(root, cur.id) ?? [root]).slice(0, -1);
  const total = root.children.reduce((s, a) => s + a.weight, 0) || 1;
  const lensOf = (row: Row) => (row.children.length ? "now" : timeOf(row, today).lens);
  const open = cur.children.filter((r) => lensOf(r) === "now" || (inPlace && lensOf(r) === "later"));
  const later = cur.children.filter((r) => lensOf(r) === "later").sort((a, b) => (timeOf(a, today).back ?? "").localeCompare(timeOf(b, today).back ?? ""));
  const done = cur.children.filter((r) => lensOf(r) === "done");
  useEffect(() => report(`${inPlace ? "E" : "D"} · at "${cur.title}" · ${open.length} rows in place, ${inPlace ? `${later.length} of them grey` : `${later.length} folded under Later`}, ${done.length} under Done`), [inPlace, cur.title, open.length, later.length, done.length, report]);
  const nextBack = (row: Row) => leaves(row).map((l) => timeOf(l, today).back).filter((b): b is string => !!b).sort()[0];
  const line = (row: Row) => {
    const c = counts(row, today);
    const back = nextBack(row);
    const away = inPlace && lensOf(row) === "later";
    return (
      <div className="vrow" key={row.id} style={away ? { opacity: 0.5 } : undefined}>
        {row.children.length ? (
          <button type="button" className="linkq" onClick={() => setAt(row.id)}>
            {row.title}
          </button>
        ) : (
          <span className="linkq">{row.title}</span>
        )}
        {row.children.length ? (
          <span className="faint">
            {c.now === 0 ? "nothing open" : `${c.now} open`}
            {c.later > 0 && back ? ` · ${c.later} later, next back ${day(back, today)}` : ""}
          </span>
        ) : (
          <Margin row={row} today={today} />
        )}
        {row.children.length ? (
          <button type="button" className="btn quiet" onClick={() => setAt(row.id)}>
            ›
          </button>
        ) : (
          <Acts row={row} today={today} act={act} />
        )}
      </div>
    );
  };
  const body = (
    <div className="cur">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{cur.title}</h2>
        {cur.focusMonth && <span className="pill think">focus this month</span>}
      </div>
      {trail.length === 1 && <Balance area={cur} total={total} />}
      <div>
        {open.map(line)}
        {open.length === 0 && <p className="muted">Nothing needs you here now.</p>}
      </div>
      {!inPlace && later.length > 0 && (
        <details className="px-band">
          <summary>
            Later · {later.length} · next back {day(timeOf(later[0]!, today).back ?? today, today)}
          </summary>
          {later.map(line)}
        </details>
      )}
      {done.length > 0 && (
        <details className="px-band">
          <summary>Done · {done.length}</summary>
          {done.map(line)}
        </details>
      )}
    </div>
  );
  return (
    <>
      {trail.reduceRight<ReactNode>(
        (inner, row) => (
          <div className="anc">
            <button type="button" className="anch" onClick={() => setAt(row.id)}>
              ‹ {row.title}
            </button>
            {inner}
          </div>
        ),
        body,
      )}
    </>
  );
}

// C: the outline as an indented list, with three weeks of days beside it. Time is a second axis.
function VariantC({ root, today, report }: Props) {
  const days = Array.from({ length: 22 }, (_, i) => shift(today, i - 7));
  useEffect(() => report(`C · whole outline · rail from ${days[0]} to ${days[21]} · read-only`), [root, report]);
  const flat: { row: Row; depth: number }[] = [];
  const walk = (row: Row, depth: number) => {
    flat.push({ row, depth });
    row.children.forEach((c) => walk(c, depth + 1));
  };
  root.children.forEach((a) => walk(a, 0));
  const upcoming = (row: Row): string[] => {
    if (!row.repeat) return [];
    const out: string[] = [];
    let from = row.done && row.completedAt ? row.completedAt : row.dueDate ? shift(row.dueDate, -1) : today;
    for (let i = 0; i < 12; i++) {
      from = nextOccurrence(from, row.repeat);
      if (from > days[21]!) break;
      out.push(from);
    }
    return out;
  };
  const mark = (row: Row, date: string): ReactNode => {
    const t = timeOf(row, today);
    if (row.log?.includes(date) || (row.done && row.completedAt === date)) return <span className="px-dot did" title={`done ${date}`} />;
    if (!row.done && row.dueDate === date) return <span className={`px-dot ${t.late ? "late" : "due"}`} title={`due ${date}`} />;
    if (upcoming(row).includes(date) && date >= today) return <span className="px-dot next" title={`comes back ${date}`} />;
    return null;
  };
  const away = (row: Row, date: string) => {
    const until = !row.done ? (row.deferredUntil ?? row.startDate) : undefined;
    return until !== undefined && date >= today && date < until;
  };
  const wd = (date: string) => new Date(date + "T00:00:00Z").getUTCDay();
  return (
    <div className="cur">
      <div className="px-legend">
        <span><i className="px-dot due" /> due</span>
        <span><i className="px-dot late" /> overdue</span>
        <span><i className="px-dot did" /> done</span>
        <span><i className="px-dot next" /> comes back</span>
        <span><i className="away" style={{ width: 22, height: 12, display: "inline-block", border: "1px solid var(--line)" }} /> put away</span>
      </div>
      <div className="px-rail">
        <div className="t h" />
        {days.map((date) => (
          <div key={date} className={`h${wd(date) % 6 === 0 ? " we" : ""}${date === today ? " td" : ""}`}>
            <span>{"SMTWTFS"[wd(date)]}</span>
            <span>{Number(date.slice(8))}</span>
          </div>
        ))}
        {flat.flatMap(({ row, depth }) => [
          <div key={row.id} className="t" style={{ paddingLeft: depth * 16, fontWeight: row.children.length ? 600 : 400 }} title={row.children.length ? "" : timeOf(row, today).margin}>
            {row.title}
            {row.repeat ? <span className="faint">&nbsp;· {rhythm(row.repeat)}</span> : null}
          </div>,
          ...days.map((date) => (
            <div key={`${row.id}:${date}`} className={`${wd(date) % 6 === 0 ? "we" : ""}${date === today ? " td" : ""}${!row.children.length && away(row, date) ? " away" : ""}`}>
              {row.children.length ? null : mark(row, date)}
            </div>
          )),
        ])}
      </div>
      <p className="faint">Rows with no mark have no date. A repeating row shows when it was done and when it comes back, by Cortex's rule: counted from the day it was last finished.</p>
    </div>
  );
}

export function EverythingPrototype() {
  const today = useMemo(() => localToday(), []);
  const params = new URLSearchParams(location.search);
  const [variant, setVariant] = useState<Key>((VARIANTS.find(([k]) => k === params.get("variant"))?.[0] ?? "A") as Key);
  const [root, setRoot] = useState<Row>(() => fixture(today));
  const [source, setSource] = useState("fixture");
  const [state, setState] = useState("");
  const [last, setLast] = useState("nothing yet");

  useEffect(() => {
    if (params.get("data") !== "live") return;
    void fetch("/api/desk/my-day")
      .then((r) => r.json())
      .then((j: { outline?: Row }) => {
        if (j.outline) {
          setRoot(j.outline);
          setSource("live /api/desk/my-day");
        }
      });
  }, []);

  const go = (step: number) => {
    const i = VARIANTS.findIndex(([k]) => k === variant);
    const next = VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length]![0];
    const p = new URLSearchParams(location.search);
    p.set("variant", next);
    history.replaceState(null, "", `?${p}`);
    setVariant(next);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const act: Props["act"] = (id, kind) => {
    const row = find(root, id);
    if (!row) return;
    setRoot(
      patch(root, id, (r) => {
        if (kind === "done") return complete(r, today);
        if (kind === "later") return { ...r, deferredUntil: shift(today, 1) };
        const { deferredUntil: _d, startDate: _s, completedAt: _c, ...rest } = r;
        return { ...rest, done: false };
      }),
    );
    const after = kind === "done" ? timeOf(complete(row, today), today).margin : kind === "later" ? "put away until tomorrow" : "back in Now";
    setLast(`${kind} on "${row.title}" → ${after} (stub, nothing sent to Cortex)`);
  };

  const props: Props = { root, today, act, report: setState };
  const name = VARIANTS.find(([k]) => k === variant)![1];
  return (
    <main className="wrap">
      <style>{CSS}</style>
      <Header />
      <div className="seg" role="tablist" aria-label="View" style={{ alignSelf: "flex-start" }}>
        {["Day", "Week", "Everything", "Delegated", "Review"].map((v) => (
          <button key={v} type="button" role="tab" aria-selected={v === "Everything"}>
            {v}
          </button>
        ))}
      </div>
      {variant === "A" && <VariantA {...props} />}
      {variant === "B" && <VariantB {...props} />}
      {variant === "C" && <VariantC {...props} />}
      {variant === "D" && <VariantD {...props} />}
      {variant === "E" && <VariantD {...props} inPlace />}
      <div className="px-state">
        {state} · today {today} · data: {source} · last act: {last} · days to the next return: {Math.min(...leaves(root).map((r) => timeOf(r, today).back).filter((b): b is string => !!b).map((b) => between(today, b)), 999)}
      </div>
      <div style={{ height: 60 }} />
      <div className="px-switch">
        <button type="button" onClick={() => go(-1)} aria-label="Previous variant">←</button>
        <span>
          {variant} ({name})
        </span>
        <button type="button" onClick={() => go(1)} aria-label="Next variant">→</button>
      </div>
    </main>
  );
}

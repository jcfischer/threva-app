import type { DeskView, StudioList, StudioOutcome, TodayTask } from "../api/types";
import { useI18n, type I18n, type TextKey } from "../i18n";
import { buildEarlier, type EarlierLine } from "./earlier";
import { clockAt, type Clock, type TimelineRow } from "./timeline";

const MINUTE = 60_000;
const SHOWN = 3;

const OUTCOME: Record<StudioOutcome, TextKey> = {
  decided: "studio.outcome.decided",
  shipped: "studio.outcome.shipped",
  dropped: "studio.outcome.dropped",
};

export function formatLength(i18n: Pick<I18n, "t">, ms: number): string {
  const total = Math.max(0, Math.round(ms / MINUTE));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return i18n.t("day.length.m", { m });
  return m === 0 ? i18n.t("day.length.h", { h }) : i18n.t("day.length.hm", { h, m });
}

function TaskChip({ task }: { task: TodayTask }) {
  return (
    <div className="chip">
      <span>{task.task.title}</span>
      <span className="faint">{task.areaTitle}</span>
    </div>
  );
}

function Happened({ line }: { line: EarlierLine }) {
  const { t, time } = useI18n();
  return (
    <div className={`line${line.ok ? "" : " failed"}`}>
      <span className="tm">{line.at === undefined ? "" : time(new Date(line.at))}</span>
      <span>
        {line.kind === "done" ? line.text : <b>{line.text}</b>}
        {line.outcome && <span className="faint"> · {t(OUTCOME[line.outcome])}</span>}
      </span>
    </div>
  );
}

function HappenedList({ lines }: { lines: readonly EarlierLine[] }) {
  const { tn } = useI18n();
  const latest = lines.slice(-SHOWN);
  const rest = lines.slice(0, Math.max(0, lines.length - SHOWN));
  return (
    <>
      {latest.map((line) => <Happened key={line.key} line={line} />)}
      {rest.length > 0 && (
        <details className="more">
          <summary>{tn("day.earlier.more", rest.length)}</summary>
          {rest.map((line) => <Happened key={line.key} line={line} />)}
        </details>
      )}
    </>
  );
}

function EarlierToday({ lines }: { lines: readonly EarlierLine[] }) {
  const { t } = useI18n();
  if (lines.length === 0) return null;
  return (
    <div className="earlier" aria-label={t("day.earlier")}>
      <span className="eyebrow">{t("day.earlier")}</span>
      {lines.map((line) => <Happened key={line.key} line={line} />)}
    </div>
  );
}

function Row({ row, now, lines }: { row: TimelineRow; now: number; lines: readonly EarlierLine[] }) {
  const i18n = useI18n();
  const { t, time } = i18n;
  const pill = row.now ? <span className="pill think">{t("day.now")}</span> : null;
  const happened = lines.length > 0 ? (
    <div className="happened">
      <HappenedList lines={lines} />
    </div>
  ) : null;
  if (row.type === "meeting") {
    return (
      <div className={`slot ev${row.past ? " past" : ""}${row.now ? " cur" : ""}`}>
        <span className="tm">{time(new Date(row.start))}</span>
        <div>
          <span className="row">
            {pill}
            <span>
              <b>{row.event.title}</b> <span className="faint">{t("meeting.span", { from: time(new Date(row.start)), to: time(new Date(row.end)) })}</span>
            </span>
            {row.now && <span className="faint">{t("day.left", { length: formatLength(i18n, row.end - now) })}</span>}
          </span>
          {happened}
        </div>
      </div>
    );
  }
  const free = t("day.free", { time: time(new Date(row.end)), length: formatLength(i18n, row.end - row.start) });
  return (
    <div className={`slot free${row.now ? " cur" : ""}${row.end <= now ? " past" : ""}`}>
      <span className="tm">{time(new Date(row.start))}</span>
      <div>
        <span className="row">
          {pill}
          <span className="faint">{row.now ? `${free} · ${t("day.left", { length: formatLength(i18n, row.end - now) })}` : free}</span>
        </span>
        {row.tasks.map((task) => <TaskChip key={task.task.id} task={task} />)}
        {happened}
      </div>
    </div>
  );
}

export function TimelineView({ view, studio = null, clock }: { view: DeskView; studio?: StudioList | null; clock?: Clock }) {
  const { t } = useI18n();
  const c = clock ?? clockAt(Date.now());
  const { timeline, rows, block } = buildEarlier(view, studio, c);
  return (
    <section className="rail timeline" aria-label={t("day.label")}>
      <span className="eyebrow">{t("day.label")}</span>
      <EarlierToday lines={block} />
      {timeline.allDay.map((e) => (
        <div className="slot ev" key={e.key} style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
          <span>
            <b>{e.title}</b> <span className="faint">{t("day.allDay")}</span>
          </span>
        </div>
      ))}
      {timeline.empty ? (
        <p className="sub">{t("day.empty")}</p>
      ) : (
        timeline.rows.map((row, i) => (
          <Row key={`${row.type}:${row.start}:${row.type === "meeting" ? row.event.key : ""}`} row={row} now={c.now} lines={rows[i] ?? []} />
        ))
      )}
      {timeline.unplaced.length > 0 && (
        <div className="slot free">
          <span className="tm" />
          <div>
            <span className="faint">{t("day.stillOpen")}</span>
            {timeline.unplaced.map((task) => <TaskChip key={task.task.id} task={task} />)}
          </div>
        </div>
      )}
    </section>
  );
}

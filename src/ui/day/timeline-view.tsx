import type { DeskEvent, TodayTask } from "../api/types";
import { useI18n, type I18n } from "../i18n";
import { buildTimeline, clockAt, type Clock, type TimelineRow } from "./timeline";

const MINUTE = 60_000;

export function formatLength(i18n: Pick<I18n, "t">, ms: number): string {
  const total = Math.max(0, Math.round(ms / MINUTE));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return i18n.t("day.length.m", { m });
  return m === 0 ? i18n.t("day.length.h", { h }) : i18n.t("day.length.hm", { h, m });
}

function Row({ row, now }: { row: TimelineRow; now: number }) {
  const i18n = useI18n();
  const { t, time } = i18n;
  const pill = row.now ? <span className="pill think">{t("day.now")}</span> : null;
  if (row.type === "meeting") {
    return (
      <div className={`slot ev${row.past ? " past" : ""}${row.now ? " cur" : ""}`}>
        <span className="tm">{time(new Date(row.start))}</span>
        <span className="row">
          {pill}
          <span>
            <b>{row.event.title}</b> <span className="faint">{t("meeting.span", { from: time(new Date(row.start)), to: time(new Date(row.end)) })}</span>
          </span>
          {row.now && <span className="faint">{t("day.left", { length: formatLength(i18n, row.end - now) })}</span>}
        </span>
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
        {row.tasks.map((task) => (
          <div className="chip" key={task.task.id}>
            <span>{task.task.title}</span>
            <span className="faint">{task.areaTitle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelineView({ today, tasks, clock }: { today: readonly DeskEvent[]; tasks: readonly TodayTask[]; clock?: Clock }) {
  const { t } = useI18n();
  const c = clock ?? clockAt(Date.now());
  const timeline = buildTimeline(today, tasks, c);
  return (
    <section className="rail timeline" aria-label={t("day.label")}>
      <span className="eyebrow">{t("day.label")}</span>
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
        timeline.rows.map((row) => <Row key={`${row.type}:${row.start}:${row.type === "meeting" ? row.event.key : ""}`} row={row} now={c.now} />)
      )}
      {timeline.unplaced.length > 0 && (
        <div className="slot free">
          <span className="tm" />
          <div>
            <span className="faint">{t("day.stillOpen")}</span>
            {timeline.unplaced.map((task) => (
              <div className="chip" key={task.task.id}>
                <span>{task.task.title}</span>
                <span className="faint">{task.areaTitle}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

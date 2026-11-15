import { useEffect, useState } from "react";
import type { DeskClient } from "../api/client";
import type { MyDayOutline } from "../api/types";
import type { DeskState } from "../queue/use-desk";
import { useI18n } from "../i18n";
import { dateInZone, weekColumns, type WeekColumn } from "./columns";

export function WeekGrid({ columns, timeZone, onOpenRow }: { columns: readonly WeekColumn[]; timeZone?: string; onOpenRow: (id: string) => void }) {
  const { t, locale } = useI18n();
  const heading = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit" });
  return <><div className="week-scroll" tabIndex={0} role="region" aria-label={t("week.label")}><div className="week-grid">
    {columns.map((column, index) => <section className={`week-day${index === 0 ? " today" : ""}`} key={column.date} data-week-date={column.date}>
      <h2>{heading.format(new Date(`${column.date}T12:00:00Z`))}{index === 0 && <span> · {t("week.today")}</span>}</h2>
      {column.events.map(event => <p className="week-event" key={event.key}><span className="tm">{event.kind === "all-day" ? t("day.allDay") : time.format(new Date(event.at))}</span> {event.title}</p>)}
      {column.events.length === 0 && <p className="faint">{t("week.empty")}</p>}
      {column.rows.map(({ row, margin }) => <button type="button" className="week-row" key={row.id} onClick={() => { onOpenRow(row.id); }}><span>{row.title}</span><span className="week-margin">{margin}</span></button>)}
    </section>)}
  </div></div><p className="faint">{t("week.hint")}</p></>;
}

export function WeekView({ client, state, onOpenRow }: { client: DeskClient; state: DeskState; onOpenRow: (id: string) => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [outline, setOutline] = useState<MyDayOutline | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void client.myDay().then(result => {
      if (!live) return;
      setLoading(false);
      setFailed(!result.ok);
      if (result.ok) setOutline(result.data);
    });
    return () => { live = false; };
  }, [client]);
  const today = outline?.date ?? state.view?.myDay?.date ?? dateInZone(state.view?.generatedAt ?? Date.now(), state.view?.timeZone);
  return <section aria-label={t("week.label")}>
    {loading && <p role="status">{t("week.loading")}</p>}
    {state.error && <p role="alert">{t("week.deskFailed")}</p>}
    {failed && <p role="alert">{t("week.outlineFailed")}</p>}
    <WeekGrid columns={weekColumns(state.view, outline, today, i18n)} timeZone={state.view?.timeZone} onOpenRow={onOpenRow} />
  </section>;
}

import type { StudioList, StudioThread } from "../api/types";
import { safeHref } from "../api/safe-link";
import { useI18n } from "../i18n";
import { ago } from "../i18n/ago";
import { orderedThreadEntries } from "../everything/thread-page";
import { ThreadDate } from "../everything/margin";
import { materialCards, noteCards } from "./cards";

export function findThread(studio: StudioList | null, slug: string): StudioThread | undefined {
  const data = studio?.studio;
  return data ? [...data.active, ...(data.parked ?? []), ...(data.closed ?? [])].find((thread) => thread.slug === slug) : undefined;
}

export function Desk({ studio, slug, loading = false, backLabel, onBack, now }: {
  studio: StudioList | null;
  slug: string;
  loading?: boolean;
  backLabel: string;
  onBack: () => void;
  now: number;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const thread = findThread(studio, slug);
  const back = <button type="button" className="btn quiet" onClick={onBack}>{backLabel}</button>;
  if (!thread) {
    return <section className="desk" aria-label={t("desk.label")}>
      {back}
      <p role="status">{loading ? t("thread.loading") : t("desk.unavailable")}</p>
    </section>;
  }
  const name = t("studio.assistant");
  const material = materialCards(thread.material ?? []);
  const notes = noteCards(thread.notes);
  return <section className="desk" aria-label={t("desk.label")}>
    <div className="desk-bar">{back}</div>
    <div className="desk-grid">
      <aside className="desk-side desk-material" aria-label={t("studio.material")}>
        <span className="eyebrow">{t("studio.material")}</span>
        {material.length === 0 && <span className="faint">{t("studio.material.none")}</span>}
        {material.map((card, index) => {
          const href = safeHref(card.href);
          return <div key={index} className="desk-card">
            {href ? <a className="lk" href={href} target="_blank" rel="noreferrer">{card.label}</a> : <span>{card.label}</span>}
            <span className="faint">{card.kind}</span>
          </div>;
        })}
      </aside>
      <div className="desk-topic stack">
        <h2 className="stq">{thread.question}</h2>
        <p className="desk-lead">{thread.stand || t("studio.stand.none")}</p>
        {orderedThreadEntries(thread).map((entry, index) => <div key={`${entry.author}-${entry.at}-${index}`} className={`thread-entry${entry.author === "assistant" ? " thread-kept" : ""}`}>
          <span className="faint">{entry.author === "assistant" ? name : t("studio.you")}, <ThreadDate at={entry.at} />: </span>{entry.text}
        </div>)}
      </div>
      <aside className="desk-side desk-notes" aria-label={t("desk.notes")}>
        <span className="eyebrow">{t("desk.notes")}</span>
        {notes.length === 0 && <span className="faint">{t("desk.notes.none")}</span>}
        {notes.map((card) => <div key={card.at} className={`desk-card desk-${card.strength}`}>
          <span>{card.sentence}</span>
          <span className="faint">{ago(i18n, card.at, now)}</span>
        </div>)}
      </aside>
    </div>
  </section>;
}

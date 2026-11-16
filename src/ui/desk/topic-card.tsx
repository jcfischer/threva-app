import type { StudioThread } from "../api/types";
import { useI18n } from "../i18n";
import { threadType } from "../studio/close";
import { ago, noteCards } from "./cards";

export function TopicCard({ topic, now, onClose, onOpenDesk }: {
  topic: StudioThread;
  now: number;
  onClose: () => void;
  onOpenDesk?: (slug: string) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const latest = noteCards(topic.notes).at(0);
  return <div className="desk-opened-body">
    <span className="eyebrow">{t(`desk.topic.type.${threadType(topic)}`)}</span>
    <b>{topic.question}</b>
    {topic.state === "parked" && <span className="faint">{t("desk.topic.parked")}</span>}
    {topic.state === "closed" && <span className="faint">{t("desk.topic.closed")}</span>}
    {latest && <>
      <span>{latest.sentence}</span>
      <span className="faint">{ago(i18n, latest.at, now)}</span>
    </>}
    <div className="row">
      {onOpenDesk && <button type="button" className="btn" onClick={() => { onOpenDesk(topic.slug); }}>{t("desk.topic.open")}</button>}
      <button type="button" className="btn quiet" onClick={onClose}>{t("desk.card.putBack")}</button>
    </div>
  </div>;
}

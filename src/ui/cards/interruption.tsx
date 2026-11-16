import type { DeskItem } from "../api/types";
import { useI18n } from "../i18n";
import { isInterrupting } from "../queue/order";
import { useDeskAct } from "../act/use-act";
import { useQueue } from "./act";
import { ErrorLine } from "./parts";

export function InterruptionFeedback({ item, answer, onAnswer }: {
  item: DeskItem;
  answer?: "yes" | "no";
  onAnswer: (answer: "yes" | "no") => void;
}) {
  const { t } = useI18n();
  const { client, refresh } = useQueue();
  const { busy, error, act, isInFlight } = useDeskAct(refresh);
  const feedback = answer ?? item.interrupt?.feedback;
  if (feedback === "no") return <p className="sub" role="status">{t("interrupt.stopped")}</p>;
  if (feedback || !isInterrupting(item)) return null;

  async function send(important: boolean) {
    const reason = item.interrupt?.reason;
    if (!reason || isInFlight()) return;
    const body = { key: item.key, code: reason.code, ...(reason.target !== undefined ? { target: reason.target } : {}), important };
    const result = await act({ interruption: body }, () => client.queue.interruptionFeedback(body));
    if (result.ok) onAnswer(important ? "yes" : "no");
  }

  return <div className="interrupt-feedback">
    <div className="row" role="group" aria-label={t("interrupt.question")}>
      <span>{t("interrupt.question")}</span>
      <button type="button" className="btn quiet" disabled={busy} onClick={() => void send(true)}>{t("interrupt.yes")}</button>
      <button type="button" className="btn quiet" disabled={busy} onClick={() => void send(false)}>{t("interrupt.no")}</button>
    </div>
    <ErrorLine error={error} />
  </div>;
}

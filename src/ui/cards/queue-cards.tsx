import { useState } from "react";
import { newRequestId } from "../api/client";
import type { DeskItem, TodayTask } from "../api/types";
import { useI18n } from "../i18n";
import { useAct } from "./act";
import { Card, ErrorLine } from "./parts";

export function AgentCard({ item }: { item: DeskItem }) {
  const { t } = useI18n();
  const { busy, error, run } = useAct();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const choices = item.explanation?.choices ?? [];
  const send = async () => {
    const result = await run("/api/desk/ruling", { key: item.key, text: text.trim(), requestId: newRequestId() });
    if (result.ok) setSent(true);
  };
  return (
    <Card eyebrow={t("card.agent.eyebrow")} pill={<span className="pill wait">{t("card.agent.waits")}</span>}>
      <span className="q">{item.title}</span>
      <span className="sub">{item.explanation?.sentence ?? item.question?.reason ?? item.why}</span>
      {choices.length > 0 && (
        <ul className="plain">
          {choices.map((c) => (
            <li key={c.label}>
              <button type="button" className="lk" onClick={() => setText(c.ruling)}>
                {c.label}
              </button>
              <span className="faint"> {c.consequence}</span>
            </li>
          ))}
        </ul>
      )}
      {sent ? (
        <span className="faint">{t("card.agent.sent")}</span>
      ) : (
        <>
          <textarea aria-label={t("card.agent.ruling")} placeholder={t("card.agent.ruling")} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          <div className="row">
            <button type="button" className="btn pri" disabled={busy || !text.trim()} onClick={send}>
              {t("card.agent.send")}
            </button>
            <button type="button" className="btn quiet" disabled={busy} onClick={() => run("/api/desk/action", { action: "ranger.approve", key: item.key })}>
              {t("card.agent.approve")}
            </button>
            {item.kind === "agent-failed" && (
              <button type="button" className="btn quiet" disabled={busy} onClick={() => run("/api/desk/action", { action: "ranger.retry", key: item.key })}>
                {t("card.agent.retry")}
              </button>
            )}
          </div>
        </>
      )}
      <ErrorLine error={error} />
    </Card>
  );
}

export function ItemCard({ item, fresh }: { item: DeskItem; fresh: boolean }) {
  const { t } = useI18n();
  const links = item.actions.filter((a) => a.url);
  return (
    <Card eyebrow={item.source || t("card.item.eyebrow")} pill={fresh ? <span className="pill think">{t("card.item.new")}</span> : undefined}>
      <span className="q">{item.title}</span>
      <span className="sub">{item.why}</span>
      {links.length > 0 && (
        <div className="row">
          {links.map((a) => (
            <a key={a.id} className="btn quiet" href={a.url} target="_blank" rel="noreferrer">
              {a.label}
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TaskCard({ task }: { task: TodayTask }) {
  const { t } = useI18n();
  const { busy, error, run } = useAct();
  return (
    <Card eyebrow={task.areaTitle || t("card.task.eyebrow")}>
      <span className="q">{task.task.title}</span>
      <div className="row">
        <button type="button" className="btn pri" disabled={busy} onClick={() => run("/api/desk/my-day", { op: "done", id: task.task.id })}>
          {t("card.task.done")}
        </button>
      </div>
      <ErrorLine error={error} />
    </Card>
  );
}

import { safeHref } from "../api/safe-link";
import { useState } from "react";
import { newRequestId } from "../api/client";
import type { DeskItem, TodayTask } from "../api/types";
import { useI18n, type TextKey } from "../i18n";
import { taskDone } from "../queue/keys";
import { useAct } from "./act";
import { Card, ErrorLine, MakeTaskButton, Mentioned } from "./parts";

// The actions POST /api/desk/action takes, labelled by action id. Cortex lists ranger.park too but never wires it
// and the endpoint refuses it, so it gets no button until both change.
const RANGER_ACTION_LABEL: Partial<Record<string, TextKey>> = {
  "ranger.retry": "card.agent.action.ranger.retry",
  "ranger.approve": "card.agent.action.ranger.approve",
};

// The card always shows the detail, and the queue's own "Not now" skips it, so "detail" and "snooze" need no button here.
export function AgentCard({ item }: { item: DeskItem }) {
  const { t } = useI18n();
  const card = useAct();
  const { busy, error, run } = card;
  const plan = card.offersTask(item);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const wired = item.actions.filter((a) => a.wired);
  const rules = wired.some((a) => a.id === "ranger.rule");
  const choices = rules ? (item.explanation?.choices ?? []) : [];
  const links = item.detail.links.flatMap((l) => { const url = safeHref(l.url); return url ? [{ label: l.label, url }] : []; });
  const opens = wired.flatMap((a) => { const url = a.id === "open" ? safeHref(a.url) : undefined; return url && !links.some((l) => l.url === url) ? [{ id: a.id, url }] : []; });
  const sends = wired.flatMap((a) => { const label = RANGER_ACTION_LABEL[a.id]; return label && !a.url ? [{ ...a, label }] : []; });
  const [own, ...related] = item.detail.refs ?? [];
  const refs = [...new Set(related)].filter((r) => r && r !== own);
  const body = item.kind === "agent-failed" && item.detail.summary ? item.detail.summary : (item.explanation?.sentence ?? item.question?.reason ?? item.why);
  const send = async () => {
    const result = await run("/api/desk/ruling", { key: item.key, text: text.trim(), requestId: newRequestId() });
    if (result.ok) setSent(true);
  };
  return (
    <Card eyebrow={t("card.agent.eyebrow")} pill={<span className="pill wait">{t("card.agent.waits")}</span>}>
      <span className="q"><Mentioned text={item.title} mentions={item.mentions} /></span>
      <span className="sub"><Mentioned text={body} mentions={item.mentions} /></span>
      {choices.length > 0 && !sent && (
        <div role="group" aria-label={t("card.agent.choices")}>
          {choices.map((c) => (
            <button key={c.label} type="button" className="chip" aria-pressed={text === c.ruling} onClick={() => setText(c.ruling)}>
              <b>{c.label}</b>
              <span className="faint">{c.consequence}</span>
            </button>
          ))}
        </div>
      )}
      {rules && (sent ? (
        <span className="faint">{t("card.agent.sent")}</span>
      ) : (
        <textarea aria-label={t("card.agent.ruling")} placeholder={t("card.agent.ruling")} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      ))}
      {(rules && !sent) || plan || sends.length > 0 || opens.length > 0 || links.length > 0 ? (
        <div className="row">
          {rules && !sent && (
            <button type="button" className="btn pri" disabled={busy || !text.trim()} onClick={send}>
              {t("card.agent.action.ranger.rule")}
            </button>
          )}
          {sends.map((a) => (
            <button key={a.id} type="button" className={a.role === "primary" ? "btn pri" : "btn"} disabled={busy} onClick={() => run("/api/desk/action", { action: a.id, key: item.key })}>
              {t(a.label)}
            </button>
          ))}
          <MakeTaskButton item={item} act={card} />
          {opens.map((a) => (
            <a key={a.url} className="btn quiet" href={a.url} target="_blank" rel="noreferrer">
              {t("card.agent.action.open")}
            </a>
          ))}
          {links.map((l) => (
            <a key={l.url} className="btn quiet" href={l.url} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
        </div>
      ) : null}
      {refs.length > 0 && <span className="faint">{t("card.agent.refs")} {refs.join(", ")}</span>}
      <ErrorLine error={error} />
    </Card>
  );
}

export function ItemCard({ item, fresh }: { item: DeskItem; fresh: boolean }) {
  const { t } = useI18n();
  const card = useAct();
  const plan = card.offersTask(item);
  const links = item.actions.flatMap((a) => { const url = safeHref(a.url); return url ? [{ ...a, url }] : []; });
  return (
    <Card eyebrow={item.source || t("card.item.eyebrow")} pill={fresh ? <span className="pill think">{t("card.item.new")}</span> : undefined}>
      <span className="q">{item.title}</span>
      <span className="sub">{item.why}</span>
      {(plan || links.length > 0) && (
        <div className="row">
          <MakeTaskButton item={item} act={card} />
          {links.map((a) => (
            <a key={a.id} className="btn quiet" href={a.url} target="_blank" rel="noreferrer">
              {a.label}
            </a>
          ))}
        </div>
      )}
      <ErrorLine error={card.error} />
    </Card>
  );
}

export function TaskCard({ task }: { task: TodayTask }) {
  const { t } = useI18n();
  const { busy, error, perform } = useAct(taskDone(task));
  return (
    <Card eyebrow={task.areaTitle || t("card.task.eyebrow")}>
      <span className="q">{task.task.title}</span>
      <div className="row">
        <button type="button" className="btn pri" disabled={busy} onClick={perform}>
          {t("card.task.done")}
        </button>
      </div>
      <ErrorLine error={error} />
    </Card>
  );
}

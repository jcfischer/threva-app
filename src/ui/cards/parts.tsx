import type { ReactNode } from "react";
import { safeHref } from "../api/safe-link";
import type { DeskItem, DeskMention } from "../api/types";
import { useI18n } from "../i18n";
import type { ActError, useAct } from "./act";

export function Card({ eyebrow, pill, children }: { eyebrow: string; pill?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <span className="row" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">{eyebrow}</span>
        {pill}
      </span>
      {children}
    </div>
  );
}

// Renders text with each substring Cortex mentions linked to its URL. Mentions with an unsafe URL stay plain;
// where two mentions start at the same place, the longer one wins.
export function Mentioned({ text, mentions = [] }: { text: string; mentions?: readonly DeskMention[] }) {
  const safe = mentions.flatMap((m) => {
    const url = safeHref(m.url);
    return url && m.text ? [{ text: m.text, url }] : [];
  });
  const parts: ReactNode[] = [];
  let rest = 0;
  while (safe.length > 0) {
    let best: { at: number; text: string; url: string } | null = null;
    for (const m of safe) {
      const at = text.indexOf(m.text, rest);
      if (at >= 0 && (!best || at < best.at || (at === best.at && m.text.length > best.text.length))) best = { at, ...m };
    }
    if (!best) break;
    if (best.at > rest) parts.push(text.slice(rest, best.at));
    parts.push(<a key={best.at} href={best.url} target="_blank" rel="noreferrer">{best.text}</a>);
    rest = best.at + best.text.length;
  }
  parts.push(text.slice(rest));
  return <>{parts}</>;
}

export function ErrorLine({ error }: { error: ActError }) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <span className="faint" role="alert">
      {error.message ?? t("error.network")}
    </span>
  );
}

// "Make it a task": one click moves the item into today's Inbox in My Day. It shows only on items Cortex lets the
// person move, and only when the Desk carried the My Day date the change needs.
export function MakeTaskButton({ item, act }: { item: DeskItem; act: Pick<ReturnType<typeof useAct>, "busy" | "makeTask" | "offersTask"> }) {
  const { t } = useI18n();
  if (!act.offersTask(item)) return null;
  return (
    <button type="button" className="btn" disabled={act.busy} onClick={() => void act.makeTask(item)}>
      {t("card.task.make")}
    </button>
  );
}

import { createContext, useContext, type ReactNode } from "react";
import { safeHref } from "@desk/safe-link";
import type { DeskItem, DeskMention } from "@desk/types";
import { useI18n } from "../i18n";
import type { ActError, useAct } from "./act";

export const CardFooterContext = createContext<ReactNode>(null);

export function Card({ eyebrow, pill, children, itemKey }: { eyebrow: string; pill?: ReactNode; children: ReactNode; itemKey?: string }) {
  const footer = useContext(CardFooterContext);
  return (
    <div className="card" data-item-key={itemKey}>
      <span className="row" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">{eyebrow}</span>
        {pill}
      </span>
      {children}
      {footer}
    </div>
  );
}

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

export function MakeTaskButton({ item, act }: { item: DeskItem; act: Pick<ReturnType<typeof useAct>, "busy" | "makeTask" | "offersTask"> }) {
  const { t } = useI18n();
  if (!act.offersTask(item)) return null;
  return (
    <button type="button" className="btn" disabled={act.busy} onClick={() => void act.makeTask(item)}>
      {t("card.task.make")}
    </button>
  );
}

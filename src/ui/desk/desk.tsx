import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DeskClient } from "@desk/client";
import type { StudioList } from "@desk/types";
import { QueueContext } from "../cards/act";
import { useI18n } from "../i18n";
import { orderedThreadEntries } from "../everything/thread-page";
import { ThreadDate } from "../everything/margin";
import { useStudioAct } from "../studio/act";
import { threadType } from "../studio/close";
import { ago, findThread, materialCards, noteCards, openThing, relationTarget, type DeskSide } from "./cards";
import { TopicCard } from "./topic-card";
import { History } from "./history";
import { openPlacement, samePlacement, OpenCard, type OpenPlacement } from "./open-card";
import { standLine, TopicMenu, TopicOutcome } from "./topic-menu";

type Left = { kind: "material"; id: string } | { kind: "topic"; slug: string };

interface Open { left: Left | null; right: string | null }

const leftId = (left: Left | null): string | null => left === null ? null : left.kind === "material" ? left.id : `topic:${left.slug}`;

const CLOSED: Open = { left: null, right: null };

/**
 * The Studio desk: material parked on the left, the topic in the middle, the assistant's notes on the right.
 * A parked card opens outwards, at full size and level with itself, and one card is open per side. The desk
 * reads its acts through the queue's client, so a test can inject its own fetch.
 */
export function Desk({ client, refresh = () => { return; }, ...rest }: {
  studio: StudioList | null;
  slug: string;
  loading?: boolean;
  backLabel: string;
  onBack: () => void;
  now: number;
  client: DeskClient;
  refresh?: () => void;
  onOpenDesk?: (slug: string) => void;
}) {
  return (
    <QueueContext.Provider value={{ client, refresh }}>
      <DeskBody key={rest.slug} {...rest} />
    </QueueContext.Provider>
  );
}

function DeskBody({ studio, slug, loading = false, backLabel, onBack, now, onOpenDesk }: {
  studio: StudioList | null;
  slug: string;
  loading?: boolean;
  backLabel: string;
  onBack: () => void;
  now: number;
  onOpenDesk?: (slug: string) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const { busy, run } = useStudioAct();
  const thread = findThread(studio, slug);
  const [open, setOpen] = useState<Open>(CLOSED);
  const [placement, setPlacement] = useState<Partial<Record<string, OpenPlacement>>>({});
  const grid = useRef<HTMLDivElement | null>(null);

  const anyOpen = open.left !== null || open.right !== null;

  useEffect(() => {
    if (!anyOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(CLOSED);
    };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); };
  }, [anyOpen]);

  useEffect(() => {
    const root = grid.current;
    if (!root || !anyOpen) return;
    const measure = () => {
      const desk = root.getBoundingClientRect();
      const middle = root.querySelector('[data-desk="middle"]')?.getBoundingClientRect();
      if (!middle) return;
      const parked = [...root.querySelectorAll<HTMLElement>("[data-desk-card]")];
      const next: Record<string, OpenPlacement> = {};
      for (const [side, id] of [["left", leftId(open.left)], ["right", open.right]] as [DeskSide, string | null][]) {
        if (id === null) continue;
        const twin = side === "left" && open.left?.kind === "topic"
          ? root.querySelector<HTMLElement>(".desk-material")
          : parked.find((card) => card.getAttribute("data-desk-card") === id);
        if (!twin) continue;
        next[id] = openPlacement({ desk, card: twin.getBoundingClientRect(), middle, side });
      }
      setPlacement((previous) => {
        const ids = Object.keys(next);
        const same = ids.length === Object.keys(previous).length && ids.every((id) => samePlacement(previous[id], next[id]));
        return same ? previous : next;
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("resize", measure); };
  }, [anyOpen, open.left, open.right, thread]);

  const back = <button type="button" className="btn quiet" onClick={onBack}>{backLabel}</button>;
  if (!thread) {
    return <section className="desk" aria-label={t("desk.label")}>
      {back}
      <p role="status">{loading ? t("thread.loading") : t("desk.unavailable")}</p>
    </section>;
  }
  const name = t("studio.assistant");
  const stand = standLine(thread);
  const material = materialCards(thread.material ?? []);
  const notes = noteCards(thread);
  const topic = open.left?.kind === "topic" ? findThread(studio, open.left.slug) : undefined;
  const left = open.left?.kind === "material" ? openThing(thread, open.left.id) : null;
  const topicId = topic ? leftId(open.left) : null;
  const right = openThing(thread, open.right);
  const rightTarget = right?.side === "right" ? relationTarget(right.note, studio) : null;

  const toggle = (side: DeskSide, id: string) => {
    setPlacement((previous) => {
      if (!(id in previous)) return previous;
      const next = Object.fromEntries(Object.entries(previous).filter(([key]) => key !== id));
      return next;
    });
    setOpen((current) => side === "right"
      ? { ...current, right: current.right === id ? null : id }
      : { ...current, left: leftId(current.left) === id ? null : { kind: "material", id } });
  };
  const close = (side: DeskSide, id: string) => { setOpen((current) => ((side === "left" ? leftId(current.left) : current.right) === id ? { ...current, [side]: null } : current)); };
  const follow = (slug: string) => { setOpen((current) => ({ ...current, left: { kind: "topic", slug } })); };
  const frame = (id: string) => {
    const placed = placement[id];
    return placed?.mode === "out" ? { left: placed.left, top: placed.top, width: placed.width } : undefined;
  };
  const placed = (id: string) => !!placement[id];

  return <section className="desk" aria-label={t("desk.label")}>
    <div className="desk-bar">{back}</div>
    <div className="desk-grid" ref={grid}>
      <aside className="desk-side desk-material" aria-label={t("studio.material")}>
        <span className="eyebrow">{t("studio.material")}</span>
        {topic && topicId && <div className="desk-opened desk-opened-left" data-desk-opened="left" data-placed={placed(topicId) ? "true" : "false"} style={frame(topicId)}>
          <TopicCard topic={topic} now={now} onClose={() => { close("left", topicId); }} onOpenDesk={onOpenDesk} />
        </div>}
        {material.length === 0 && <span className="faint">{t("studio.material.none")}</span>}
        {material.map((card) => <DeskCardShell
          key={card.id}
          side="left"
          id={card.id}
          className={`desk-card${leftId(open.left) === card.id ? " desk-held" : ""}`}
          expanded={leftId(open.left) === card.id}
          onToggle={() => { toggle("left", card.id); }}
          frame={frame(card.id)}
          placed={placed(card.id)}
          parked={<>
            <span>{card.label}</span>
            <span className="faint">{card.kind}</span>
          </>}
          opened={left?.id === card.id
            ? <OpenCard thing={left} slug={slug} now={now} onClose={() => { close("left", card.id); }} run={run} busy={busy} />
            : null}
        />)}
      </aside>
      <div className="desk-topic stack" data-desk="middle">
        <div className="desk-head">
          <h2 className="stq">{thread.question}</h2>
          {thread.state !== "closed" && <TopicMenu key={`${thread.slug}-${threadType(thread)}`} thread={thread} busy={busy} run={run} />}
        </div>
        {stand !== null && <p className="desk-lead">{stand}</p>}
        {thread.state === "closed" && <TopicOutcome thread={thread} />}
        {orderedThreadEntries(thread).map((entry, index) => <div key={`${entry.author}-${entry.at}-${index}`} className={`thread-entry${entry.author === "assistant" ? " thread-kept" : ""}`}>
          <span className="faint">{entry.author === "assistant" ? name : t("studio.you")}, <ThreadDate at={entry.at} />: </span>{entry.text}
        </div>)}
      </div>
      <aside className="desk-side desk-notes" aria-label={t("desk.notes")}>
        {thread.state !== "closed" && thread.thinkTonight === true && <p className="desk-promise" data-desk-promise="true">{t("desk.tonight.promise")}</p>}
        <span className="eyebrow">{t("desk.notes")}</span>
        {notes.length === 0 && <span className="faint">{t("desk.notes.none")}</span>}
        {notes.map((card) => <DeskCardShell
          key={card.id}
          side="right"
          id={card.id}
          className={`desk-card desk-${card.strength}${open.right === card.id ? " desk-held" : ""}`}
          expanded={open.right === card.id}
          onToggle={() => { toggle("right", card.id); }}
          frame={frame(card.id)}
          placed={placed(card.id)}
          parked={<>
            {card.kind === "relation" && <span className="eyebrow">{t("studio.kind.relation")}</span>}
            <span>{card.sentence}</span>
            <span className="faint">{ago(i18n, card.at, now)}</span>
          </>}
          opened={right?.id === card.id
            ? <OpenCard thing={right} slug={slug} now={now} onClose={() => { close("right", card.id); }} run={run} busy={busy} target={rightTarget} onFollow={follow} />
            : null}
        />)}
        {right && !notes.some((card) => card.id === right.id) && <div className="desk-opened desk-opened-right" data-desk-opened="right" data-placed="false">
          <OpenCard thing={right} slug={slug} now={now} onClose={() => { close("right", right.id); }} run={run} busy={busy} target={rightTarget} onFollow={follow} />
        </div>}
      </aside>
    </div>
    <History thread={thread} onOpenNote={(id) => { setOpen((current) => ({ ...current, right: id })); }} />
  </section>;
}

function DeskCardShell({ side, id, className, expanded, onToggle, frame, placed, parked, opened }: {
  side: DeskSide;
  id: string;
  className: string;
  expanded: boolean;
  onToggle: () => void;
  frame: { left: number; top: number; width: number } | undefined;
  placed: boolean;
  parked: ReactNode;
  opened: ReactNode;
}) {
  return <>
    <button type="button" className={className} data-desk-card={id} aria-expanded={expanded} onClick={onToggle}>
      {parked}
    </button>
    {opened && <div className={`desk-opened desk-opened-${side}`} data-desk-opened={side} data-placed={placed ? "true" : "false"} style={frame}>
      {opened}
    </div>}
  </>;
}

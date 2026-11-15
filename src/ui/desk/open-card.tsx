import { useState } from "react";
import type { Result } from "../api/client";
import type { StudioAct } from "../api/types";
import { safeHref } from "../api/safe-link";
import { ErrorLine } from "../cards/parts";
import type { ActError } from "../cards/act";
import { useI18n } from "../i18n";
import { Markdown } from "../markdown";
import { ago, type OpenThing } from "./cards";

/** The narrowest and widest an opened card gets when it opens outwards. */
export const OPEN_CARD_MIN = 280;
export const OPEN_CARD_MAX = 380;
/** The distance between a parked card and the card that opens from it. */
export const OPEN_CARD_GAP = 12;

export interface Frame {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Where an opened card stands: outwards and level with its parked card, or in place below it when the zones stack. */
export interface OpenPlacement {
  mode: "out" | "stack";
  left: number;
  top: number;
  width: number;
}

const beside = (side: "left" | "right", card: Frame, middle: Pick<Frame, "left" | "right">): boolean =>
  side === "right" ? card.left >= middle.right - 1 : card.right <= middle.left + 1;

function outwards(room: number): number {
  return Math.min(OPEN_CARD_MAX, Math.max(OPEN_CARD_MIN, room));
}

/**
 * Where a card opens from the boxes of the desk, of its parked card and of the middle zone, all in the same
 * viewport coordinates, with the answer relative to the desk.
 *
 * On a wide desk the card opens outwards, beside its parked card and away from the middle, as wide as the
 * space outside the column allows between 280 and 380 pixels. Where that space is thinner than 280 pixels,
 * the card overlaps its own column instead, and its inner edge stops at the middle zone. Where the zones
 * stack, the card opens in place, directly below its parked card and as wide as the zone.
 */
export function openPlacement({ desk, card, middle, side }: {
  desk: Frame;
  card: Frame;
  middle: Pick<Frame, "left" | "right">;
  side: "left" | "right";
}): OpenPlacement {
  if (!beside(side, card, middle)) {
    return { mode: "stack", left: card.left - desk.left, top: card.bottom - desk.top + OPEN_CARD_GAP, width: card.width };
  }
  const inner = (side === "right" ? middle.right : middle.left) - desk.left;
  const outer = side === "right" ? desk.width : 0;
  const room = side === "right"
    ? outer - (card.right - desk.left + OPEN_CARD_GAP)
    : card.left - desk.left - OPEN_CARD_GAP;
  const zone = side === "right" ? outer - inner : inner;
  const width = Math.min(zone, outwards(room));
  const at = side === "right"
    ? Math.min(outer - width, card.right - desk.left + OPEN_CARD_GAP)
    : Math.max(0, card.left - desk.left - OPEN_CARD_GAP - width);
  return {
    mode: "out",
    left: side === "right" ? Math.max(at, inner) : Math.min(at, inner - width),
    top: card.top - desk.top,
    width,
  };
}

/** Whether two placements describe the same frame, so a measure that changed nothing keeps the old state. */
export function samePlacement(a: OpenPlacement | undefined, b: OpenPlacement | undefined): boolean {
  if (!a || !b) return a === b;
  return a.mode === b.mode && a.left === b.left && a.top === b.top && a.width === b.width;
}

export type OpenAct = (act: StudioAct) => Promise<Result<{ message?: string }>>;

export interface OpenCardProps {
  thing: OpenThing;
  slug: string;
  now: number;
  onClose: () => void;
  run: OpenAct;
  busy?: boolean;
}

/**
 * One card of the desk, opened at full size. A material card shows its label, its kind and, when the link is
 * safe, the link. A note shows its whole text as Markdown, how long ago it was written, its trigger and model
 * behind a details toggle, and while it is open the acts the Studio offers: keep, dismiss and a one-line
 * answer. A refused act shows Cortex's own message and keeps what was typed.
 */
export function OpenCard({ thing, slug, now, onClose, run, busy = false }: OpenCardProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<ActError>(null);

  async function send(act: StudioAct) {
    setError(null);
    const result = await run(act);
    if (result.ok) onClose();
    else setError({ message: result.message });
  }

  const putBack = <button type="button" className="btn quiet" onClick={onClose}>{t("desk.card.putBack")}</button>;

  if (thing.side === "left") {
    const { material } = thing;
    const href = safeHref(material.href);
    return (
      <div className="desk-opened-body">
        <span className="eyebrow">{t("studio.material")}</span>
        <b>{material.label}</b>
        <span className="faint">{material.kind}</span>
        {href && <a className="lk" href={href} target="_blank" rel="noreferrer">{href}</a>}
        <div className="row">{putBack}</div>
      </div>
    );
  }

  const { note } = thing;
  const open = note.status === "open";
  const takesKeep = open && (note.kind === "stand" || note.kind === "idea");
  const details = !!note.trigger || !!note.model;
  return (
    <div className="desk-opened-body">
      <span className="eyebrow">{t("studio.assistant")} · {ago(i18n, note.at, now)}</span>
      <Markdown text={note.text} />
      {details && (
        <details className="desk-details">
          <summary>{t("desk.card.details")}</summary>
          {note.trigger && <span className="faint">{t("desk.card.trigger")}: {note.trigger}</span>}
          {note.model && <span className="faint">{t("desk.card.model")}: {note.model}</span>}
        </details>
      )}
      {open && (
        <input
          type="text"
          aria-label={t("desk.card.answer.label")}
          placeholder={t("desk.card.answer")}
          value={answer}
          onInput={(event) => { setAnswer(event.currentTarget.value); }}
          onKeyDownCapture={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            const text = answer.trim();
            if (!text || busy) return;
            event.preventDefault();
            void send({ act: "respond", thread: slug, text });
          }}
        />
      )}
      <div className="row">
        {takesKeep && (
          <button type="button" className="btn pri" disabled={busy} onClick={() => void send({ act: "keep", thread: slug, note: note.at })}>
            {note.kind === "stand" ? t("studio.keepStand") : t("studio.keep")}
          </button>
        )}
        {takesKeep && (
          <button type="button" className="btn quiet" disabled={busy} onClick={() => void send({ act: "dismiss", thread: slug, note: note.at })}>
            {t("studio.dismiss")}
          </button>
        )}
        {putBack}
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

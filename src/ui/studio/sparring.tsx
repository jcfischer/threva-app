import { useEffect, useState } from "react";
import type { SparMode, StudioThread } from "../api/types";
import { ErrorLine } from "../cards/parts";
import { useI18n, type TextKey } from "../i18n";
import { useStudioAct } from "./act";

export type { SparMode } from "../api/types";

export interface SparRequest {
  mode: SparMode;
  key: TextKey;
  /** The persona behind a "What would X say?" button, as Cortex lists it. */
  name?: string;
}

const MODES: { mode: SparMode; key: TextKey }[] = [
  { mode: "think", key: "studio.spar.think" },
  { mode: "grill", key: "studio.spar.grill" },
  { mode: "other-side", key: "studio.spar.otherSide" },
  { mode: "red-team", key: "studio.spar.redTeam" },
  { mode: "first-principles", key: "studio.spar.firstPrinciples" },
];

/** The five modes, then one request per name in Cortex's `studio.personas`, in the order Cortex lists them. */
export function sparRequests(personas: readonly string[] = []): SparRequest[] {
  return [
    ...MODES,
    ...personas.map((name) => ({ mode: `persona:${name}` as SparMode, key: "studio.spar.persona" as TextKey, name })),
  ];
}

/** Whether the rail sends, and whose reason to show when it does not. Cortex's reason stays Cortex's wording. */
export type SparAvailability = { ready: true } | { ready: false; reason: string | null };

export function sparAvailability(thinking: StudioThread["thinking"]): SparAvailability {
  if (!thinking) return { ready: false, reason: null };
  if (thinking.kind === "unavailable") return { ready: false, reason: thinking.reason };
  return thinking.budget === "open" ? { ready: true } : { ready: false, reason: thinking.reason };
}

/** The modes Cortex still holds an unfinished run for, so a button stays marked after the answer. A failed run is not
 * one: its reason shows and its button stays open, because asking again is how you retry. */
export function pendingModes(thinking: StudioThread["thinking"]): string[] {
  return thinking?.kind === "ready" ? thinking.runs.filter((run) => run.status === "pending").map((run) => run.mode) : [];
}

export interface SparringProps {
  thread: StudioThread;
  personas?: readonly string[];
}

export function Sparring({ thread, personas = [] }: SparringProps) {
  const { t } = useI18n();
  const { busy, error, run } = useStudioAct();
  const [sent, setSent] = useState<{ mode: SparMode; message?: string } | null>(null);
  const thinking = thread.thinking;
  const availability = sparAvailability(thinking);
  const blocked = availability.ready ? null : (availability.reason ?? t("studio.spar.notLoaded"));
  const pending = pendingModes(thinking);
  const queued = sent ? [sent.mode, ...pending] : pending;
  // Once Cortex serves the run, its own queue is the truth and the local mark can go.
  useEffect(() => {
    if (sent && pendingModes(thread.thinking).includes(sent.mode)) setSent(null);
  }, [sent, thread.thinking]);
  if (thread.state === "closed") return null;
  const send = async (mode: SparMode) => {
    const result = await run({ act: "spar", thread: thread.slug, mode });
    if (result.ok) setSent({ mode, ...(result.data.message ? { message: result.data.message } : {}) });
  };
  return (
    <div className="strel" role="group" aria-label={t("studio.spar")}>
      <span className="eyebrow">{t("studio.spar")}</span>
      <span className="faint">{t("studio.spar.hint")}</span>
      {blocked !== null && (
        <span className="faint" role="status">
          {blocked}
        </span>
      )}
      <div className="row">
        {sparRequests(personas).map(({ mode, key, name }) => {
          const label = t(key, name ? { name } : undefined);
          const isQueued = queued.includes(mode);
          return (
            <button
              key={mode}
              type="button"
              className="btn"
              disabled={busy || blocked !== null || isQueued}
              title={blocked ?? undefined}
              onClick={() => void send(mode)}
            >
              {isQueued ? t("studio.spar.queued", { label }) : label}
            </button>
          );
        })}
      </div>
      {sent && (
        <span className="faint" role="status">
          {sent.message ?? t("studio.spar.sent")}
        </span>
      )}
      {thinking?.kind === "ready" &&
        thinking.runs.map((run) => (
          <span key={run.id} className="faint" role="status">
            {t(run.status === "failed" ? "studio.spar.failed" : "studio.spar.pending")} · {run.reason}
          </span>
        ))}
      <ErrorLine error={error} />
    </div>
  );
}

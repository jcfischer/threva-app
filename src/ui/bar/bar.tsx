import { useReducer } from "react";
import { create, filesAtOnce, propose } from "../api/capture";
import { newRequestId, type DeskClient } from "../api/client";
import { useI18n, type I18n } from "../i18n";
import type { Entry } from "../queue/order";
import { barReducer, INITIAL, type BarEvent, type BarState } from "./state";
import { actFor, suggest, type Suggestion } from "./suggest";

function rowLabel(t: I18n["t"], row: Suggestion): string {
  if (row.kind === "match") return row.title;
  return row.kind === "ask" ? t("bar.row.ask", { text: row.text }) : t("bar.row.note", { text: row.text });
}

export function BarView({ state, send, onSubmit, onKeep, onAsk, onUndo, entries = [] }: {
  state: BarState;
  send: (e: BarEvent) => void;
  onSubmit: (row?: Suggestion) => void;
  onKeep: () => void;
  onAsk: () => void;
  onUndo: () => void;
  entries?: readonly Entry[];
}) {
  const { t } = useI18n();
  const text = "text" in state ? state.text : "";
  const busy = state.phase === "asking" || state.phase === "creating" || state.phase === "talking";
  const rows = state.phase === "idle" ? suggest(text, entries) : [];
  const marked = state.phase === "idle" ? Math.min(state.active, Math.max(rows.length - 1, 0)) : 0;
  return (
    <section className="bar1" aria-label={t("bar.label")}>
      <input
        type="text"
        aria-label={t("bar.label")}
        placeholder={t("bar.placeholder")}
        value={text}
        disabled={busy}
        onChange={(e) => send({ type: "typed", text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") return onSubmit(rows[marked]);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            return send({ type: "move", delta: e.key === "ArrowDown" ? 1 : -1, count: rows.length });
          }
          if (e.key === "Escape") send({ type: "clear" });
        }}
      />
      {rows.length > 0 && (
        <div className="sugg" role="listbox" aria-label={t("bar.list")}>
          {rows.map((row, i) => (
            <button
              key={row.kind === "match" ? `m:${row.entry.k}` : row.kind}
              type="button"
              role="option"
              aria-selected={i === marked}
              className={i === marked ? "sg-on" : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSubmit(row)}
            >
              <span>{rowLabel(t, row)}</span>
              {row.kind === "match" && <span className="faint">{row.front ? t("bar.row.front") : t("bar.row.later")}</span>}
            </button>
          ))}
        </div>
      )}
      {busy && <span className="faint">{t("bar.working")}</span>}
      {(state.phase === "proposed" || state.phase === "creating") && (
        <div className="card">
          <span className="eyebrow">{state.proposal.label}</span>
          <span className="q">{String(state.proposal.fields.title ?? state.proposal.fields.text ?? text)}</span>
          {state.proposal.problem && <span className="faint">{state.proposal.problem}</span>}
          <div className="row">
            {state.proposal.kind !== "conversation" && !state.proposal.problem && (
              <button type="button" className="btn pri" disabled={state.phase === "creating"} onClick={onKeep}>
                {t("bar.keep")}
              </button>
            )}
            {(state.proposal.kind === "conversation" || state.proposal.alternative) && (
              <button type="button" className={state.proposal.kind === "conversation" ? "btn pri" : "btn"} onClick={onAsk}>
                {t("bar.ask")}
              </button>
            )}
            <button type="button" className="btn quiet" onClick={() => send({ type: "reject" })}>
              {t("bar.reject")}
            </button>
          </div>
        </div>
      )}
      {state.phase === "created" && (
        <div className="toast row">
          <span>{state.message || t("bar.created")}</span>
          {state.undo && (
            <button type="button" className="lk" onClick={onUndo}>
              {t("undo")}
            </button>
          )}
        </div>
      )}
      {state.phase === "conversation" && <span className="faint">{t("bar.started")}</span>}
      {state.phase === "error" && (
        <span className="faint" role="alert">
          {state.message ?? t("error.network")}
        </span>
      )}
    </section>
  );
}

export type BarSend = (event: BarEvent) => void;

// The note row runs today's proposal flow. Cortex marks a capture `automatic` once studio.capture is granted,
// so Threva files that one at once and shows the "Kept." line instead of the card. Every other proposal shows its card.
export async function takeNote(client: DeskClient, text: string, send: BarSend, onChange: () => void): Promise<void> {
  const typed = text.trim();
  if (!typed) return;
  send({ type: "submit" });
  const asked = await propose(client, typed);
  if (!asked.ok) return send({ type: "failed", message: asked.message });
  const { proposal } = asked.data;
  send({ type: "proposed", proposal });
  if (!filesAtOnce(proposal)) return;
  const requestId = newRequestId();
  send({ type: "keep" });
  const created = await create(client, proposal, requestId);
  if (!created.ok) return send({ type: "failed", message: created.message });
  const id = created.data.id;
  send({ type: "created", message: "", undo: id !== undefined ? { id: String(id), requestId } : null });
  onChange();
}

// The ask row starts the conversation the way the card's ask button does.
export async function takeAsk(client: DeskClient, text: string, send: BarSend): Promise<void> {
  const typed = text.trim();
  if (!typed) return;
  send({ type: "ask" });
  const started = await client.post("/api/conversations/asks", { text: typed, startId: crypto.randomUUID() });
  send(started.ok ? { type: "started" } : { type: "failed", message: started.message });
}

export function Bar({ client, entries = [], onPull, onChange }: {
  client: DeskClient;
  entries?: readonly Entry[];
  onPull?: (k: string) => void;
  onChange: () => void;
}) {
  const [state, send] = useReducer(barReducer, INITIAL);
  const text = "text" in state ? state.text : "";

  const onSubmit = async (row?: Suggestion) => {
    if (!text.trim() || (state.phase !== "idle" && state.phase !== "error")) return;
    const act = actFor(row);
    if (act.kind === "ask") return takeAsk(client, text, send);
    if (act.kind === "match") {
      send({ type: "clear" });
      onPull?.(act.k);
      return;
    }
    return takeNote(client, text, send, onChange);
  };

  const onKeep = async () => {
    if (state.phase !== "proposed") return;
    const requestId = newRequestId();
    send({ type: "keep" });
    const created = await create(client, state.proposal, requestId);
    if (!created.ok) return send({ type: "failed", message: created.message });
    const id = created.data.id;
    send({ type: "created", message: created.data.message ?? "", undo: state.proposal.kind === "capture" && id !== undefined ? { id: String(id), requestId } : null });
    onChange();
  };

  const onUndo = async () => {
    if (state.phase !== "created" || !state.undo) return;
    const undone = await client.post("/api/desk/capture/undo", state.undo);
    send(undone.ok ? { type: "reset" } : { type: "failed", message: undone.message });
    onChange();
  };

  return <BarView state={state} send={send} onSubmit={onSubmit} onKeep={onKeep} onAsk={() => takeAsk(client, text, send)} onUndo={onUndo} entries={entries} />;
}

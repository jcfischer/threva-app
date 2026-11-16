import { useReducer } from "react";
import { useDeskAct } from "../act/use-act";
import type { DeskClient, Result } from "../api/client";
import { create, filesAtOnce, propose, type Created, type Proposal } from "../api/capture";
import { useI18n, type I18n } from "../i18n";
import type { Entry } from "../queue/order";
import { barReducer, INITIAL, type BarEvent, type BarState } from "./state";
import { actFor, suggest, type Suggestion } from "./suggest";

type Act = ReturnType<typeof useDeskAct>["act"];

export type BarSend = (event: BarEvent) => void;

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

async function capture(client: DeskClient, act: Act, proposal: Proposal): Promise<{ result: Result<Created>; requestId: string }> {
  let requestId = "";
  const result = await act({ capture: "create", kind: proposal.kind, fields: proposal.fields }, (id) => {
    requestId = id;
    return create(client, proposal, id);
  });
  return { result, requestId };
}

export async function takeNote(client: DeskClient, text: string, send: BarSend, act: Act): Promise<void> {
  const typed = text.trim();
  if (!typed) return;
  send({ type: "submit" });
  const asked = await propose(client, typed);
  if (!asked.ok) return send({ type: "failed", message: asked.message });
  const { proposal } = asked.data;
  send({ type: "proposed", proposal });
  if (!filesAtOnce(proposal)) return;
  send({ type: "keep" });
  const { result, requestId } = await capture(client, act, proposal);
  if (!result.ok) return send({ type: "failed", message: result.message });
  const id = result.data.id;
  send({ type: "created", message: "", undo: id === undefined ? null : { id: String(id), requestId } });
}

export async function takeAsk(client: DeskClient, text: string, send: BarSend): Promise<void> {
  const typed = text.trim();
  if (!typed) return;
  send({ type: "ask" });
  const started = await client.conversations.ask(typed);
  send(started.ok ? { type: "started" } : { type: "failed", message: started.message });
}

export function Bar({ client, entries = [], onPull, onChange }: {
  client: DeskClient;
  entries?: readonly Entry[];
  onPull?: (k: string) => void;
  onChange: () => void;
}) {
  const [state, send] = useReducer(barReducer, INITIAL);
  const { act } = useDeskAct(onChange);
  const text = "text" in state ? state.text : "";

  const onSubmit = async (row?: Suggestion) => {
    if (!text.trim() || (state.phase !== "idle" && state.phase !== "error")) return;
    const next = actFor(row);
    if (next.kind === "ask") return takeAsk(client, text, send);
    if (next.kind === "match") {
      send({ type: "clear" });
      onPull?.(next.k);
      return;
    }
    return takeNote(client, text, send, act);
  };

  const onKeep = async () => {
    if (state.phase !== "proposed") return;
    const proposal = state.proposal;
    send({ type: "keep" });
    const { result, requestId } = await capture(client, act, proposal);
    if (!result.ok) return send({ type: "failed", message: result.message });
    const id = result.data.id;
    send({ type: "created", message: result.data.message ?? "", undo: proposal.kind === "capture" && id !== undefined ? { id: String(id), requestId } : null });
  };

  const onUndo = async () => {
    if (state.phase !== "created" || !state.undo) return;
    const handle = state.undo;
    const undone = await act({ capture: "undo", ...handle }, () => client.capture.undo(handle));
    send(undone.ok ? { type: "reset" } : { type: "failed", message: undone.message });
  };

  return <BarView state={state} send={send} onSubmit={onSubmit} onKeep={onKeep} onAsk={() => takeAsk(client, text, send)} onUndo={onUndo} entries={entries} />;
}

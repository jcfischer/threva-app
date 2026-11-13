import { useReducer } from "react";
import { create, propose } from "../api/capture";
import { newRequestId, type DeskClient } from "../api/client";
import { useI18n } from "../i18n";
import { barReducer, INITIAL, looksLikeQuestion, type BarEvent, type BarState } from "./state";

export function BarView({ state, send, onSubmit, onKeep, onAsk, onUndo }: {
  state: BarState;
  send: (e: BarEvent) => void;
  onSubmit: () => void;
  onKeep: () => void;
  onAsk: () => void;
  onUndo: () => void;
}) {
  const { t } = useI18n();
  const text = "text" in state ? state.text : "";
  const busy = state.phase === "asking" || state.phase === "creating" || state.phase === "talking";
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
          if (e.key === "Enter") onSubmit();
        }}
      />
      {state.phase === "idle" && text.trim() && looksLikeQuestion(text) && (
        <div className="row">
          <button type="button" className="btn" onClick={onAsk}>
            {t("bar.ask")}
          </button>
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

export function Bar({ client, onChange }: { client: DeskClient; onChange: () => void }) {
  const [state, send] = useReducer(barReducer, INITIAL);
  const text = "text" in state ? state.text : "";

  const onSubmit = async () => {
    if (!text.trim() || (state.phase !== "idle" && state.phase !== "error")) return;
    send({ type: "submit" });
    const asked = await propose(client, text.trim());
    send(asked.ok ? { type: "proposed", proposal: asked.data.proposal } : { type: "failed", message: asked.message });
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

  const onAsk = async () => {
    if (!text.trim()) return;
    send({ type: "ask" });
    const started = await client.post("/api/conversations/asks", { text: text.trim(), startId: crypto.randomUUID() });
    send(started.ok ? { type: "started" } : { type: "failed", message: started.message });
  };

  const onUndo = async () => {
    if (state.phase !== "created" || !state.undo) return;
    const undone = await client.post("/api/desk/capture/undo", state.undo);
    send(undone.ok ? { type: "reset" } : { type: "failed", message: undone.message });
    onChange();
  };

  return <BarView state={state} send={send} onSubmit={onSubmit} onKeep={onKeep} onAsk={onAsk} onUndo={onUndo} />;
}

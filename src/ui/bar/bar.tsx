import { useReducer } from "react";
import { useDeskAct, type DeskAct } from "../act/use-act";
import { openSearchHit } from "./search-result";
import type { DeskClient, DeskSearchHit } from "@desk/client";
import { create, filesAtOnce, propose, type Created, type Proposal } from "@desk/capture";
import { useI18n, type I18n } from "../i18n";
import type { Entry } from "../queue/order";
import { barReducer, canSubmit, INITIAL, type BarEvent, type BarState } from "./state";
import { actFor, suggest, type Suggestion } from "./suggest";

export type BarSend = (event: BarEvent) => void;

function rowLabel(t: I18n["t"], row: Suggestion): string {
  if (row.kind === "match") return row.title;
  if (row.kind === "search") return t("bar.row.search", { text: row.text });
  return row.kind === "ask" ? t("bar.row.ask", { text: row.text }) : t("bar.row.note", { text: row.text });
}

export function BarView({ state, send, onSubmit, onSearch, onNote, onKeep, onAsk, onUndo, onOpenHit, entries = [] }: {
  state: BarState;
  send: (e: BarEvent) => void;
  onSubmit: (row?: Suggestion) => void;
  onSearch: () => void;
  onNote: () => void;
  onKeep: () => void;
  onAsk: () => void;
  onUndo: () => void;
  onOpenHit: (hit: DeskSearchHit) => void;
  entries?: readonly Entry[];
}) {
  const { t } = useI18n();
  const text = "text" in state ? state.text : "";
  const busy = state.phase === "asking" || state.phase === "creating" || state.phase === "talking" || state.phase === "searching";
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
        onChange={(e) => { send({ type: "typed", text: e.target.value }); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSubmit(rows[marked]);
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            send({ type: "move", delta: e.key === "ArrowDown" ? 1 : -1, count: rows.length });
            return;
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
              onMouseDown={(e) => { e.preventDefault(); }}
              onClick={() => { onSubmit(row); }}
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
            <button type="button" className="btn quiet" onClick={() => { send({ type: "reject" }); }}>
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
      {state.phase === "search-error" && (
        <div className="card">
          <p className="faint" role="alert">{t("bar.search.unavailable")}</p>
          <div className="row">
            <button type="button" className="btn pri" onClick={onSearch}>{t("bar.search.retry")}</button>
            <button type="button" className="btn" onClick={onNote}>{t("bar.search.note")}</button>
          </div>
        </div>
      )}
      {state.phase === "results" && (
        <div className="card">
          {state.unavailable && <p className="faint" role="status">{t("bar.search.partial")}</p>}
          {state.hits.length === 0 && !state.unavailable && <p role="status">{t("bar.search.empty")}</p>}
          {state.hits.length > 0 && (
            <ul className="plain">
              {state.hits.map((hit) => (
                <li key={`${hit.kind}:${hit.id}`}>
                  <button type="button" className="lk" onClick={() => { onOpenHit(hit); }}>{hit.title}</button>
                </li>
              ))}
            </ul>
          )}
          {state.open && (
            <div className="card">
              <strong>{state.open.hit.title}</strong>
              <button type="button" className="btn quiet" onClick={() => { send({ type: "close-hit" }); }}>{t("bar.search.close")}</button>
              {state.open.failed ? <p role="alert">{t("bar.search.openError")}</p> :
                state.open.text === undefined ? <p role="status">{t("bar.working")}</p> :
                <div className="bar-note-text" style={{ whiteSpace: "pre-wrap" }}>{state.open.text}</div>}
            </div>
          )}
        </div>
      )}
      {state.phase === "error" && (
        <span className="faint" role="alert">
          {state.message ?? t("error.network")}
        </span>
      )}
    </section>
  );
}

interface Outcome {
  message: (created: Created) => string;
  undoable: (id: Created["id"]) => boolean;
}

async function keepProposal(client: DeskClient, act: DeskAct, proposal: Proposal, send: BarSend, outcome: Outcome): Promise<void> {
  let requestId = "";
  const result = await act({ capture: "create", kind: proposal.kind, fields: proposal.fields }, (id) => {
    requestId = id;
    return create(client, proposal, id);
  });
  if (!result.ok) { send({ type: "failed", message: result.message }); return; }
  const id = result.data.id;
  send({ type: "created", message: outcome.message(result.data), undo: outcome.undoable(id) ? { id: String(id), requestId } : null });
}

export async function takeNote(client: DeskClient, text: string, send: BarSend, act: DeskAct): Promise<void> {
  const typed = text.trim();
  if (!typed) return;
  send({ type: "submit" });
  const asked = await propose(client, typed);
  if (!asked.ok) { send({ type: "failed", message: asked.message }); return; }
  const { proposal } = asked.data;
  send({ type: "proposed", proposal });
  if (!filesAtOnce(proposal)) return;
  send({ type: "keep" });
  await keepProposal(client, act, proposal, send, { message: () => "", undoable: (id) => id !== undefined });
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

  const onSearch = async () => {
    if (!canSubmit(state)) return;
    send({ type: "search" });
    const result = await client.search(text.trim());
    send(result.ok ? { type: "found", hits: result.data.hits, unavailable: result.data.unavailableKinds.length > 0 } : { type: "search-failed" });
  };

  const onSubmit = async (row?: Suggestion) => {
    if (!canSubmit(state)) return;
    const next = actFor(row);
    if (next.kind === "search") return onSearch();
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
    await keepProposal(client, act, proposal, send, {
      message: (created) => created.message ?? "",
      undoable: (id) => proposal.kind === "capture" && id !== undefined,
    });
  };

  const onUndo = async () => {
    if (state.phase !== "created" || !state.undo) return;
    const handle = state.undo;
    const undone = await act({ capture: "undo", ...handle }, () => client.capture.undo(handle));
    send(undone.ok ? { type: "reset" } : { type: "failed", message: undone.message });
  };

  const onOpenHit = async (hit: DeskSearchHit) => {
    send({ type: "open-hit", hit });
    const result = await openSearchHit(client, hit);
    send({ type: "opened-hit", hit, text: result.ok ? result.data : undefined });
  };

  return (
    <BarView
      state={state}
      send={send}
      entries={entries}
      onSubmit={(row) => { void (state.phase === "search-error" && !row ? onSearch() : onSubmit(row)); }}
      onSearch={() => { void onSearch(); }}
      onNote={() => { void takeNote(client, text, send, act); }}
      onKeep={() => { void onKeep(); }}
      onAsk={() => { void takeAsk(client, text, send); }}
      onUndo={() => { void onUndo(); }}
      onOpenHit={(hit) => { void onOpenHit(hit); }}
    />
  );
}

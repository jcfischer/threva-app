import type { Proposal } from "@desk/capture";

import type { DeskSearchHit } from "@desk/client";

export type BarState =
  | { phase: "searching"; text: string }
  | { phase: "results"; text: string; hits: DeskSearchHit[]; unavailable: boolean; open?: { hit: DeskSearchHit; text?: string; failed?: boolean } }
  | { phase: "search-error"; text: string }
  | { phase: "idle"; text: string; active: number }
  | { phase: "asking"; text: string }
  | { phase: "proposed"; text: string; proposal: Proposal }
  | { phase: "creating"; text: string; proposal: Proposal }
  | { phase: "created"; message: string; undo: { id: string; requestId: string } | null }
  | { phase: "talking"; text: string }
  | { phase: "conversation"; text: string }
  | { phase: "error"; text: string; message: string | null };

export type BarEvent =
  | { type: "search" }
  | { type: "found"; hits: DeskSearchHit[]; unavailable: boolean }
  | { type: "search-failed" }
  | { type: "open-hit"; hit: DeskSearchHit }
  | { type: "opened-hit"; hit: DeskSearchHit; text?: string }
  | { type: "close-hit" }
  | { type: "typed"; text: string }
  | { type: "move"; delta: number; count: number }
  | { type: "clear" }
  | { type: "submit" }
  | { type: "proposed"; proposal: Proposal }
  | { type: "keep" }
  | { type: "created"; message: string; undo: { id: string; requestId: string } | null }
  | { type: "reject" }
  | { type: "ask" }
  | { type: "started" }
  | { type: "failed"; message: string | null }
  | { type: "reset" };

export const INITIAL: BarState = { phase: "idle", text: "", active: 0 };

function textOf(state: BarState): string {
  return "text" in state ? state.text : "";
}

export function looksLikeQuestion(text: string): boolean {
  return /\?\s*$/.test(text.trim());
}

export function barReducer(state: BarState, event: BarEvent): BarState {
  switch (event.type) {
    case "search":
      return { phase: "searching", text: textOf(state) };
    case "found":
      return state.phase === "searching" ? { phase: "results", text: state.text, hits: event.hits, unavailable: event.unavailable } : state;
    case "search-failed":
      return state.phase === "searching" ? { phase: "search-error", text: state.text } : state;
    case "open-hit":
      return state.phase === "results" ? { ...state, open: { hit: event.hit } } : state;
    case "opened-hit":
      return state.phase === "results" && state.open?.hit === event.hit
        ? { ...state, open: { hit: event.hit, text: event.text, failed: event.text === undefined } }
        : state;
    case "close-hit":
      return state.phase === "results" ? { ...state, open: undefined } : state;
    case "typed":
      return { phase: "idle", text: event.text, active: 0 };
    case "move": {
      if (state.phase !== "idle" || event.count <= 0) return state;
      const active = (state.active + event.delta + event.count) % event.count;
      return { phase: "idle", text: state.text, active };
    }
    case "clear":
      return INITIAL;
    case "submit":
      return textOf(state).trim() && (state.phase === "idle" || state.phase === "error" || state.phase === "search-error" || state.phase === "results") ? { phase: "asking", text: textOf(state) } : state;
    case "proposed":
      return state.phase === "asking" ? { phase: "proposed", text: state.text, proposal: event.proposal } : state;
    case "keep":
      return state.phase === "proposed" ? { phase: "creating", text: state.text, proposal: state.proposal } : state;
    case "created":
      return { phase: "created", message: event.message, undo: event.undo };
    case "reject":
      return { phase: "idle", text: textOf(state), active: 0 };
    case "ask":
      return textOf(state).trim() ? { phase: "talking", text: textOf(state) } : state;
    case "started":
      return { phase: "conversation", text: textOf(state) };
    case "failed":
      return { phase: "error", text: textOf(state), message: event.message };
    case "reset":
      return INITIAL;
  }
}

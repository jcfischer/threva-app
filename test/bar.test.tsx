import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Proposal } from "../src/ui/api/capture";
import { BarView } from "../src/ui/bar/bar";
import { barReducer, INITIAL, looksLikeQuestion, type BarState } from "../src/ui/bar/state";
import { createI18n, I18nProvider } from "../src/ui/i18n";

const task: Proposal = { kind: "task", label: "Task", fields: { title: "Buy milk" } };
const conversation: Proposal = { kind: "conversation", label: "Conversation", fields: { text: "Why?" } };

describe("bar state", () => {
  test("empty or blank text is never sent", () => {
    expect(barReducer(INITIAL, { type: "submit" })).toEqual(INITIAL);
    expect(barReducer({ phase: "idle", text: "   " }, { type: "submit" })).toEqual({ phase: "idle", text: "   " });
  });

  test("text goes through asking, proposed, creating and created", () => {
    let s: BarState = barReducer(INITIAL, { type: "typed", text: "Buy milk" });
    s = barReducer(s, { type: "submit" });
    expect(s.phase).toBe("asking");
    s = barReducer(s, { type: "proposed", proposal: task });
    expect(s.phase).toBe("proposed");
    s = barReducer(s, { type: "keep" });
    expect(s.phase).toBe("creating");
    s = barReducer(s, { type: "created", message: "Filed under Errands.", undo: null });
    expect(s).toEqual({ phase: "created", message: "Filed under Errands.", undo: null });
  });

  test("a failure keeps the typed text", () => {
    const s = barReducer({ phase: "creating", text: "Buy milk", proposal: task }, { type: "failed", message: "Tasks are not set up on this stack." });
    expect(s).toEqual({ phase: "error", text: "Buy milk", message: "Tasks are not set up on this stack." });
    expect(barReducer(s, { type: "submit" }).phase).toBe("asking");
  });

  test("rejecting a proposal returns to the text", () => {
    expect(barReducer({ phase: "proposed", text: "Buy milk", proposal: task }, { type: "reject" })).toEqual({ phase: "idle", text: "Buy milk" });
  });

  test("a question offers asking", () => {
    expect(looksLikeQuestion("What did I decide about the budget?")).toBe(true);
    expect(looksLikeQuestion("Buy milk")).toBe(false);
  });
});

describe("bar rendering", () => {
  const render = (state: BarState, locale: "en" | "de" = "en") =>
    renderToStaticMarkup(
      <I18nProvider value={createI18n(locale)}>
        <BarView state={state} send={() => {}} onSubmit={() => {}} onKeep={() => {}} onAsk={() => {}} onUndo={() => {}} />
      </I18nProvider>,
    );

  test("a task proposal offers Keep and Not like this", () => {
    const html = render({ phase: "proposed", text: "Buy milk", proposal: task });
    expect(html).toContain("Buy milk");
    expect(html).toContain("Keep");
    expect(html).toContain("Not like this");
    expect(html).not.toContain("Ask the assistant");
  });

  test("a conversation proposal offers asking instead of keeping", () => {
    const html = render({ phase: "proposed", text: "Why?", proposal: conversation });
    expect(html).toContain("Ask the assistant");
    expect(html).not.toContain(">Keep<");
  });

  test("an error shows Cortex's message, in German the bar's labels change", () => {
    expect(render({ phase: "error", text: "x", message: "Tasks are not set up on this stack." })).toContain("Tasks are not set up on this stack.");
    expect(render(INITIAL, "de")).toContain("Schreib etwas auf oder stell eine Frage");
  });
});

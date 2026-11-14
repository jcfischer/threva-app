import { useEffect, useRef, useState } from "react";
import type { LiftOutcome } from "./lift";
import { EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, keymap, placeholder, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { ensureSyntaxTree, HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { tags } from "@lezer/highlight";

// The Markdown marks hidden on every line the cursor is not in, so the page reads formatted.
const HIDDEN = new Set(["HeaderMark", "QuoteMark", "EmphasisMark", "StrikethroughMark", "CodeMark", "CodeInfo", "LinkMark", "URL"]);
const HEADINGS = new Map([["ATXHeading1", "cm-note-h1"], ["SetextHeading1", "cm-note-h1"], ["ATXHeading2", "cm-note-h2"], ["SetextHeading2", "cm-note-h2"], ["ATXHeading3", "cm-note-h3"]]);
const BLOCKS = new Map([["Blockquote", "cm-note-quote"], ["FencedCode", "cm-note-code"], ["CodeBlock", "cm-note-code"]]);

const highlights = HighlightStyle.define([
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.monospace, fontFamily: "var(--mono)", fontSize: "13px" },
  { tag: tags.link, color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: "3px" },
  { tag: [tags.url, tags.labelName], color: "var(--accent)" },
  { tag: tags.quote, color: "var(--dim)" },
]);

function noteMarks(view: EditorView): DecorationSet {
  const { state } = view;
  const live = new Set<number>();
  if (view.hasFocus) {
    for (const range of state.selection.ranges) {
      const first = state.doc.lineAt(range.from).number;
      const last = state.doc.lineAt(range.to).number;
      for (let line = first; line <= last; line++) live.add(line);
    }
  }
  const marks: { from: number; to: number; value: Decoration }[] = [];
  const mark = (from: number, to: number, value: Decoration) => marks.push({ from, to, value });
  // A page is at most 10,000 characters, so the whole tree is parsed rather than only what is on screen.
  const tree = ensureSyntaxTree(state, state.doc.length, 100) ?? syntaxTree(state);
  tree.iterate({
    enter: node => {
      const block = BLOCKS.get(node.name);
      if (block) {
        for (let at = node.from; at <= node.to;) {
          const line = state.doc.lineAt(at);
          if (line.from > node.to) break;
          mark(line.from, line.from, Decoration.line({ class: block }));
          at = line.to + 1;
        }
        return;
      }
      const heading = HEADINGS.get(node.name);
      if (heading) {
        const line = state.doc.lineAt(node.from);
        mark(line.from, line.from, Decoration.line({ class: heading }));
        return;
      }
      if (!HIDDEN.has(node.name) || node.from === node.to) return;
      if (live.has(state.doc.lineAt(node.from).number)) return;
      mark(node.from, node.to, Decoration.replace({}));
    },
  });
  marks.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(marks, true);
}

const formatted = () => ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) {
    this.decorations = noteMarks(view);
  }
  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.focusChanged || update.viewportChanged) this.decorations = noteMarks(update.view);
  }
}, { decorations: plugin => plugin.decorations });

export interface NoteEditorProps {
  value: string;
  label: string;
  hint: string;
  place: number | null;
  clean?: boolean;
  onChange(text: string): void;
  onLeave(text: string, at: number): void;
  onLift?(request: { page: string; from: number; to: number }): Promise<LiftOutcome>;
  liftLabel?: string;
  liftKeys?: string;
}

interface Bar {
  left: number;
  top: number;
}

/**
 * The page's editor: Markdown shown formatted, with the marks of the line the cursor is in.
 * If the rich editor cannot start, the page still takes plain Markdown in a text field.
 */
export function NoteEditor({ value, label, hint, place, clean = true, onChange, onLeave, onLift, liftLabel = "", liftKeys = "" }: NoteEditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const syncing = useRef(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const lifting = useRef(false);
  const lift = useRef(onLift);
  lift.current = onLift;
  const [plain, setPlain] = useState(false);
  const [bar, setBar] = useState<Bar | null>(null);
  const place_ = () => {
    const editor = view.current;
    const box = wrap.current;
    const range = editor?.state.selection.main;
    if (!editor || !box || !range || range.empty || !lift.current) return setBar(null);
    try {
      const start = editor.coordsAtPos(range.from);
      const outer = box.getBoundingClientRect();
      if (!start) return setBar(null);
      setBar({ left: Math.max(0, start.left - outer.left), top: start.top - outer.top - 40 });
    } catch {
      setBar({ left: 0, top: -40 });
    }
  };
  const run = async () => {
    const editor = view.current;
    const act = lift.current;
    if (!editor || !act || lifting.current) return false;
    const { from, to } = editor.state.selection.main;
    if (from === to) return false;
    const page = editor.state.doc.toString();
    lifting.current = true;
    try {
      const outcome = await act({ page, from, to });
      if (outcome.state === "empty" || outcome.state === "refused" || view.current !== editor) return true;
      const now = editor.state.doc.toString();
      const at = Math.min(from, outcome.page.length);
      if (now === outcome.page) {
        editor.dispatch({ selection: { anchor: at } });
      } else if (now === page) {
        syncing.current = outcome.state === "lifted";
        try {
          editor.dispatch({ changes: { from: 0, to: page.length, insert: outcome.page }, selection: { anchor: at } });
        } finally {
          syncing.current = false;
        }
      } else {
        editor.dispatch({ changes: { from, to: Math.min(to, now.length) } });
      }
      editor.focus();
    } finally {
      lifting.current = false;
    }
    return true;
  };
  const runRef = useRef(run);
  runRef.current = run;
  const barRef = useRef(place_);
  barRef.current = place_;
  // One editor per page: only a clean page takes a later outline reload, so what the user is typing stays put.
  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let editor: EditorView;
    try {
      editor = new EditorView({ parent, state: EditorState.create({ doc: value, extensions: extensions({ label, hint, onChange: text => { if (!syncing.current) onChange(text); }, onLeave, onLift: () => { void runRef.current(); }, onSelect: () => barRef.current() }) }) });
    } catch {
      // A host without the DOM pieces CodeMirror needs still takes the page as plain Markdown.
      setPlain(true);
      return;
    }
    view.current = editor;
    if (place !== null) {
      const at = Math.min(place, editor.state.doc.length);
      editor.dispatch({ selection: { anchor: at }, scrollIntoView: true });
      editor.focus();
    }
    return () => {
      view.current = null;
      onLeave(editor.state.doc.toString(), editor.state.selection.main.head);
      editor.destroy();
    };
  }, []);
  // A clean page follows a later outline reload, in the rich editor and in the plain field alike, so
  // leaving after a reload sends the reloaded text rather than what was there before it.
  useEffect(() => {
    const editor = view.current;
    if (editor) {
      if (!clean || editor.state.doc.toString() === value) return;
      syncing.current = true;
      try {
        editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
      } finally {
        syncing.current = false;
      }
      return;
    }
    const area = field.current;
    if (!area || !clean || area.value === value) return;
    area.value = value;
  }, [value, clean]);
  if (plain) return <div className="note-editor note-plain">
    <textarea ref={field} aria-label={label} placeholder={hint} defaultValue={value} onInput={event => onChange(event.currentTarget.value)} onBlur={event => onLeave(event.currentTarget.value, event.currentTarget.selectionStart)} />
  </div>;
  return <div className="note-wrap" ref={wrap}>
    <div className="note-editor" ref={host} />
    {bar && <div className="lift-bar" style={{ left: bar.left, top: bar.top }} onMouseDown={event => event.preventDefault()}>
      <button type="button" className="btn" onClick={() => { void run(); }}>{liftLabel}<kbd>{liftKeys}</kbd></button>
    </div>}
  </div>;
}

function extensions({ label, hint, onChange, onLeave, onLift, onSelect }: { label: string; hint: string; onChange: (text: string) => void; onLeave: (text: string, at: number) => void; onLift: () => void; onSelect: () => void }): Extension[] {
  return [
    history(),
    EditorView.domEventHandlers({ blur: (_event, view) => { onLeave(view.state.doc.toString(), view.state.selection.main.head); } }),
    markdown({ base: markdownLanguage }),
    EditorView.lineWrapping,
    keymap.of([{ key: "Mod-Enter", run: view => { if (view.state.selection.main.empty) return false; onLift(); return true; } }, ...defaultKeymap, ...historyKeymap]),
    placeholder(hint),
    EditorView.contentAttributes.of({ "aria-label": label, "aria-multiline": "true" }),
    syntaxHighlighting(highlights),
    formatted(),
    EditorView.updateListener.of(update => {
      if (update.docChanged) onChange(update.state.doc.toString());
      if (update.selectionSet || update.docChanged || update.geometryChanged || update.viewportChanged || update.focusChanged) onSelect();
    }),
  ];
}

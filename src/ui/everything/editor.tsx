import { useEffect, useRef, useState } from "react";
import type { LiftOutcome } from "./lift";
import { Annotation, Compartment, EditorState, type ChangeDesc, type Extension } from "@codemirror/state";
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

export interface LineDecoration {
  matches(text: string): boolean;
  className: string;
  plainClassName: string;
  hint: string;
}

export interface EnterLine {
  from: number;
  to: number;
  text: string;
  /** Null when this editor is gone or cannot safely apply a delayed edit. */
  read(): string | null;
  remove(range: { from: number; to: number }): void;
}

function noteMarks(view: EditorView, decoration?: LineDecoration): DecorationSet {
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
  if (decoration) {
    for (let number = 1; number <= state.doc.lines; number++) {
      const line = state.doc.line(number);
      if (decoration.matches(line.text)) mark(line.from, line.from, Decoration.line({ class: decoration.className, attributes: { "data-hint": decoration.hint } }));
    }
  }
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

const refreshMarks = Annotation.define<boolean>();
const formatted = (decoration: () => LineDecoration | undefined) => ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) {
    this.decorations = noteMarks(view, decoration());
  }
  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.focusChanged || update.viewportChanged || update.transactions.some(tr => tr.annotation(refreshMarks))) {
      this.decorations = noteMarks(update.view, decoration());
    }
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
  lineDecoration?: LineDecoration;
  onEnter?(line: EnterLine): boolean;
  onEdit?(changes: ChangeDesc): void;
}

interface Bar {
  left: number;
  top: number;
}

/**
 * The page's editor: Markdown shown formatted, with the marks of the line the cursor is in.
 * If the rich editor cannot start, the page still takes plain Markdown in a text field.
 */
export function NoteEditor({ value, label, hint, place, clean = true, onChange, onLeave, onLift, liftLabel = "", liftKeys = "", lineDecoration, onEnter, onEdit }: NoteEditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const syncing = useRef(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const lifting = useRef(false);
  const span = useRef<{ from: number; to: number } | null>(null);
  const lines = useRef({ lineDecoration, onEnter, onEdit });
  lines.current = { lineDecoration, onEnter, onEdit };
  const lift = useRef(onLift);
  lift.current = onLift;
  const [plain, setPlain] = useState(false);
  const [hintSlot] = useState(() => new Compartment());
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
    span.current = { from, to };
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
        const kept = span.current;
        if (kept && kept.from < kept.to) editor.dispatch({ changes: { from: kept.from, to: kept.to } });
      }
      editor.focus();
    } finally {
      lifting.current = false;
      span.current = null;
    }
    return true;
  };
  const runRef = useRef(run);
  runRef.current = run;
  const barRef = useRef(place_);
  barRef.current = place_;
  const enterLine = (editor: EditorView) => {
    if (!lines.current.onEnter || editor.composing || !editor.state.selection.main.empty) return false;
    const line = editor.state.doc.lineAt(editor.state.selection.main.head);
    return lines.current.onEnter({ from: line.from, to: line.to, text: line.text,
      read: () => view.current === editor ? editor.state.doc.toString() : null,
      remove: range => editor.dispatch({ changes: range }),
    });
  };
  // One editor per page: only a clean page takes a later outline reload, so what the user is typing stays put.
  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let editor: EditorView;
    try {
      editor = new EditorView({ parent, state: EditorState.create({ doc: value, extensions: extensions({ label, hint: hintSlot.of(placeholder(hint)), decoration: () => lines.current.lineDecoration, enterLine, onChange: text => { if (!syncing.current) onChange(text); }, onLeave, onLift: () => { void runRef.current(); }, onSelect: () => barRef.current(), onEdit: changes => {
        const kept = span.current;
        if (kept) span.current = { from: changes.mapPos(kept.from, 1), to: changes.mapPos(kept.to, -1) };
        lines.current.onEdit?.(changes);
      } }) }) });
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
  useEffect(() => { view.current?.dispatch({ effects: hintSlot.reconfigure(placeholder(hint)) }); }, [hint, hintSlot]);
  useEffect(() => { view.current?.dispatch({ annotations: refreshMarks.of(true) }); }, [lineDecoration]);
  const hasDecoratedLine = plain && lineDecoration && value.split("\n").some(line => lineDecoration.matches(line));
  if (plain) return <div className="note-editor note-plain">
    <textarea ref={field} aria-label={label} placeholder={hint} defaultValue={value} onInput={event => onChange(event.currentTarget.value)} onBlur={event => onLeave(event.currentTarget.value, event.currentTarget.selectionStart)}
      className={hasDecoratedLine ? lineDecoration.plainClassName : undefined}
      onKeyDown={event => {
        if (!onEnter || event.key !== "Enter" || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.nativeEvent.isComposing) return;
        const area = event.currentTarget;
        if (area.selectionStart !== area.selectionEnd) return;
        const before = area.value;
        const from = before.lastIndexOf("\n", area.selectionStart - 1) + 1;
        const end = before.indexOf("\n", area.selectionStart);
        const to = end === -1 ? before.length : end;
        if (onEnter({ from, to, text: before.slice(from, to),
          read: () => field.current === area && area.value === before ? before : null,
          remove: range => {
            area.value = before.slice(0, range.from) + before.slice(range.to);
            area.setSelectionRange(range.from, range.from);
            onChange(area.value);
          },
        })) event.preventDefault();
      }} />
    {hasDecoratedLine && <span className="faint">{lineDecoration.hint}</span>}
  </div>;
  return <div className="note-wrap" ref={wrap}>
    <div className="note-editor" ref={host} />
    {bar && <div className="lift-bar" style={{ left: bar.left, top: bar.top }} onMouseDown={event => event.preventDefault()}>
      <button type="button" className="btn" onClick={() => { void run(); }}>{liftLabel}<kbd>{liftKeys}</kbd></button>
    </div>}
  </div>;
}

function extensions({ label, hint, onChange, onLeave, onLift, onSelect, onEdit, decoration, enterLine }: { label: string; hint: Extension; onChange: (text: string) => void; onLeave: (text: string, at: number) => void; onLift: () => void; onSelect: () => void; onEdit: (changes: ChangeDesc) => void; decoration: () => LineDecoration | undefined; enterLine: (view: EditorView) => boolean }): Extension[] {
  return [
    history(),
    EditorView.domEventHandlers({ blur: (_event, view) => { onLeave(view.state.doc.toString(), view.state.selection.main.head); } }),
    markdown({ base: markdownLanguage }),
    EditorView.lineWrapping,
    keymap.of([{ key: "Enter", run: enterLine }, { key: "Mod-Enter", run: view => { if (view.state.selection.main.empty) return false; onLift(); return true; } }, ...defaultKeymap, ...historyKeymap]),
    hint,
    EditorView.contentAttributes.of({ "aria-label": label, "aria-multiline": "true" }),
    syntaxHighlighting(highlights),
    formatted(decoration),
    EditorView.updateListener.of(update => {
      if (update.docChanged) { onEdit(update.changes); onChange(update.state.doc.toString()); }
      if (update.selectionSet || update.docChanged || update.geometryChanged || update.viewportChanged || update.focusChanged) onSelect();
    }),
  ];
}

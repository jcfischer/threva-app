import { useEffect, useRef, useState } from "react";
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
  onChange(text: string): void;
  onLeave(text: string, at: number): void;
}

/**
 * The page's editor: Markdown shown formatted, with the marks of the line the cursor is in.
 * If the rich editor cannot start, the page still takes plain Markdown in a text field.
 */
export function NoteEditor({ value, label, hint, place, onChange, onLeave }: NoteEditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const [plain, setPlain] = useState(false);
  // One editor per page: the text of later outline reloads must not replace what the user is typing.
  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let view: EditorView;
    try {
      view = new EditorView({ parent, state: EditorState.create({ doc: value, extensions: extensions({ label, hint, onChange, onLeave }) }) });
    } catch {
      // A host without the DOM pieces CodeMirror needs still takes the page as plain Markdown.
      setPlain(true);
      return;
    }
    if (place !== null) {
      const at = Math.min(place, view.state.doc.length);
      view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
      view.focus();
    }
    return () => {
      onLeave(view.state.doc.toString(), view.state.selection.main.head);
      view.destroy();
    };
  }, []);
  if (plain) return <div className="note-editor note-plain">
    <textarea aria-label={label} placeholder={hint} defaultValue={value} onInput={event => onChange(event.currentTarget.value)} onBlur={event => onLeave(event.currentTarget.value, event.currentTarget.selectionStart)} />
  </div>;
  return <div className="note-editor" ref={host} />;
}

function extensions({ label, hint, onChange, onLeave }: { label: string; hint: string; onChange: (text: string) => void; onLeave: (text: string, at: number) => void }): Extension[] {
  return [
    history(),
    EditorView.domEventHandlers({ blur: (_event, view) => { onLeave(view.state.doc.toString(), view.state.selection.main.head); } }),
    markdown({ base: markdownLanguage }),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap]),
    placeholder(hint),
    EditorView.contentAttributes.of({ "aria-label": label, "aria-multiline": "true" }),
    syntaxHighlighting(highlights),
    formatted(),
    EditorView.updateListener.of(update => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
  ];
}

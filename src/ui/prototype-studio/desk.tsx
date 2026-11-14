// PROTOTYPE, round 3: the Studio as a work desk on a wide screen, after Scott Jenson's Akademy talk (from 32:34).
// The thing you are making sits full size in the middle. Material is parked small on the left, the assistant's
// notes small on the right. Click one and it comes to the desk; drag it onto the draft and it lands on that line.
// Three ways a card opens, one per variant: over the draft (G), outwards over its own edge (H), or as a floating
// card you place anywhere and that stays there (I). Throwaway. The draft is not in the Cortex API today.
import { useEffect, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from "react";
import { NoteEditor, type PageController } from "../everything/editor";
import { ago, firstSentence, waiting, type Note, type Topic } from "./data";
import { Md, type Acts } from "./prototype";

export const DESK_CSS = `
.dk{display:grid;grid-template-columns:minmax(170px,1fr) minmax(480px,720px) minmax(170px,1fr);gap:18px;align-items:start;position:relative}
.dk-edge{display:flex;flex-direction:column;gap:10px;padding-top:6px}
.dk-edge.l{align-items:flex-end}
.dk-edge.r{align-items:flex-start}
.dk-edge .eyebrow{width:100%;max-width:240px}
.dk-mini{width:100%;max-width:240px;border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:8px 10px;font-size:11.5px;line-height:1.4;max-height:104px;overflow:hidden;opacity:.62;cursor:grab;text-align:left;color:inherit;font-family:inherit;transition:opacity .12s,transform .12s;position:relative}
.dk-mini:hover{opacity:1;transform:scale(1.03)}
.dk-mini b{display:block;font-size:12px;margin-bottom:2px}
.dk-mini.waits{max-height:none;opacity:1;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.dk-mini.far{max-width:190px;font-size:10px;max-height:64px;opacity:.4}
.dk-mini.on{opacity:.25}
.dk-mini.used{text-decoration:line-through;opacity:.3}
.dk-mid{position:relative}
.dk-paper{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:38px 46px 60px;box-shadow:0 10px 40px rgba(0,0,0,.18);min-height:70vh}
.dk-paper.over{outline:2px dashed var(--accent);outline-offset:4px}
.dk-paper h2{font-size:23px;line-height:1.25;margin:0 0 6px}
.dk-lead{font-size:16.5px;color:var(--dim);border-left:3px solid var(--accent);padding-left:12px;margin:10px 0 22px}
.dk-paper .note-editor{border:0;border-radius:0;overflow:visible}
.dk-paper .note-editor .cm-scroller{max-height:none;padding:0;font-size:16px;line-height:1.65}
.dk-paper .cm-line.dk-target{box-shadow:0 2px 0 var(--accent)}
.dk-slot{width:380px;border:1px solid var(--line);border-radius:6px;background:var(--panel);padding:16px 18px;display:flex;flex-direction:column;gap:10px;position:absolute;top:34px;z-index:5;max-height:78vh;overflow:auto;box-shadow:0 18px 60px rgba(0,0,0,.45)}
.dk-slot.note{border-color:var(--accent)}
.dk-slot.l.over{left:-28px}
.dk-slot.r.over{right:-28px}
.dk-slot.l.out{right:calc(100% + 12px)}
.dk-slot.r.out{left:calc(100% + 12px)}
.dk-slot.float{top:auto;padding-top:0}
.dk-grip{cursor:move;margin:0 -18px;padding:9px 18px 7px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;user-select:none;touch-action:none;position:sticky;top:0;background:var(--panel)}
.dk-ask{font-weight:650;font-size:17px}
.dk-sel{position:fixed;left:50%;bottom:70px;transform:translateX(-50%);background:var(--fg);color:var(--bg);border-radius:10px;padding:6px 8px;display:flex;gap:6px;align-items:center;font-size:13.5px;z-index:40;max-width:90vw}
.dk-sel i{opacity:.7;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dk-sel button{background:none;border:1px solid currentColor;color:inherit;border-radius:7px;padding:4px 9px;font:inherit;cursor:pointer;white-space:nowrap}
.dk-time{display:flex;gap:3px;align-items:flex-end;height:54px;margin:26px auto 0;max-width:900px;width:100%}
.dk-seg{flex:1;border:0;border-radius:3px;cursor:pointer;min-width:6px;opacity:.75;position:relative}
.dk-seg:hover{opacity:1}
.dk-seg.you{background:var(--ok);height:26px}
.dk-seg.them{background:var(--accent);height:40px}
.dk-seg.mat{background:var(--wait);height:18px}
.dk-legend span{white-space:nowrap}
.dk-legend{display:flex;justify-content:space-between;max-width:900px;margin:4px auto 0;width:100%;font-size:12px;color:var(--faint)}
@media (max-width:1100px){.dk{grid-template-columns:minmax(0,1fr)}.dk-edge.l,.dk-edge.r{align-items:stretch}.dk-slot:not(.float){position:static;width:auto}}
`;

export type DeskMode = "over" | "out" | "float";

interface Scrap {
  id: string;
  title: string;
  kind: string;
  body: string;
  at: number;
}

interface Place {
  x: number;
  y: number;
}

const DAY = 86_400_000;
const PLACES = "threva-prototype-desk-places";

const DRAFT = `## The first five minutes

A newcomer opens the Desk and sees one card. Not a list, not a tour. The card says what it is and why it is here, in one sentence each.

The first three cards are **chosen, not ranked**. They are real cards from the person's own day.

## What we do not explain

The name of the product. The Everything view. The Studio. Each of them appears the first time it is needed.

## Open

How does the person learn that there is more behind the card?
`;

const scraps = (now: number): Scrap[] => [
  { id: "m1", kind: "Recording", title: "First five minutes with the Desk", at: now - 9 * DAY, body: "00:04 reads the header.\n00:09 scrolls, looking for a list.\n00:11 clicks \"Everything\".\n02:40 comes back to the Day only after being told to.\n03:15 \"Oh, it is one at a time. Why did nobody say?\"" },
  { id: "m2", kind: "Mail", title: "Re: showing the Desk to the team", at: now - 6 * DAY, body: "I tried to explain it to Andrea in the corridor and could not. I ended up saying \"it is like an inbox but for everything\", which is wrong, but she nodded." },
  { id: "m3", kind: "Clipping", title: "Onboarding without onboarding", at: now - 4 * DAY, body: "The products people learn fastest do not explain themselves. The first action is the explanation. If the first action needs a sentence of setup, that sentence is the product's real first screen." },
  { id: "m4", kind: "Screenshot", title: "Day view, 3 November", at: now - 11 * DAY, body: "One meeting card on top, forty items in the bar, the eye goes to the card and stays there." },
];

const bare = (line: string) => line.replace(/^#+\s*|^>\s*/, "").replace(/\*\*/g, "").trim();

/** The page with `line` as its own paragraph after the paragraph that shows as `after`, or at the end. */
function withLine(page: string, line: string, after: string | null): string {
  const lines = page.split("\n");
  const at = after ? lines.findIndex((l) => l.trim() && bare(l) === after.trim()) : -1;
  if (at < 0) return `${page.trimEnd()}\n\n${line}\n`;
  let end = at;
  while (end + 1 < lines.length && lines[end + 1]!.trim()) end++;
  lines.splice(end + 1, 0, "", line);
  return lines.join("\n");
}

function savedPlaces(): { [id: string]: Place } {
  try {
    return JSON.parse(localStorage.getItem(PLACES) ?? "{}") as { [id: string]: Place };
  } catch {
    return {};
  }
}

export function Desk({ topic, act, now, mode = "over" }: { topic: Topic; act: Acts; now: number; mode?: DeskMode }) {
  const [draft, setDraft] = useState(DRAFT);
  const [material, setMaterial] = useState(() => scraps(now));
  // Which cards are on the desk. Over and outwards hold one per side; floating holds any number.
  const [out, setOut] = useState<string[]>([]);
  const [places, setPlaces] = useState(savedPlaces);
  const [used, setUsed] = useState<string[]>([]);
  const [target, setTarget] = useState<Element | null>(null);
  const [sel, setSel] = useState<{ text: string; from: "draft" | string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [said, setSaid] = useState("");
  const page = useRef<PageController | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const grab = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOut([]); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(PLACES, JSON.stringify(places)); } catch { /* the desk still works without it */ }
  }, [places]);
  useEffect(() => {
    target?.classList.add("dk-target");
    return () => target?.classList.remove("dk-target");
  }, [target]);

  const waits = new Set(waiting(topic).map((n) => n.id));
  const notes = topic.notes.filter((n) => n.status !== "dismissed").sort((a, b) => b.at - a.at);
  const isNote = (id: string) => topic.notes.some((n) => n.id === id);
  const side = (id: string) => (isNote(id) ? "r" : "l");

  const put = (id: string) => setOut((o) => o.filter((x) => x !== id));
  const bring = (id: string, at?: Place) => {
    if (at) setPlaces((p) => ({ ...p, [id]: at }));
    else if (mode === "float" && !places[id]) {
      const width = root.current?.clientWidth ?? 1200;
      const n = out.length;
      setPlaces((p) => ({ ...p, [id]: { x: side(id) === "l" ? 200 + 26 * n : width - 600 - 26 * n, y: 30 + 26 * n } }));
    }
    setOut((o) => (o.includes(id) ? (at ? o : o.filter((x) => x !== id)) : mode === "float" ? [...o, id] : [...o.filter((x) => side(x) !== side(id)), id]));
  };

  const add = (line: string, from: string, after: string | null) => {
    page.current?.apply((text) => withLine(text, line, after));
    setUsed((u) => [...u, from]);
    setSaid(after ? "Dropped into the draft at that line." : "Added at the end of the draft.");
  };
  const useNote = (n: Note, after: string | null = null) => {
    add(firstSentence(n.text.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? n.text), n.id, after);
    if (n.kind === "note") act.answer(n.id, "(worked into the draft)");
    else act.keep(n.id);
    put(n.id);
  };
  const useScrap = (s: Scrap, text: string | null = null, after: string | null = null) => {
    add(`> ${(text ?? s.body.split("\n").pop() ?? s.body).replace(/\n/g, "\n> ")}`, s.id, after);
    put(s.id);
  };

  const lineUnder = (e: DragEvent) => document.elementFromPoint(e.clientX, e.clientY)?.closest(".dk-paper .cm-line") ?? null;
  const inPaper = (e: DragEvent) => !!document.elementFromPoint(e.clientX, e.clientY)?.closest(".dk-paper");
  // Capture phase, so the editor never takes the drop as pasted text.
  const dragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setTarget(mode === "float" ? null : lineUnder(e));
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain");
    const rect = root.current?.getBoundingClientRect();
    const line = lineUnder(e)?.textContent ?? null;
    setTarget(null);
    if (!id || !rect) return;
    if (mode === "float") return bring(id, { x: e.clientX - rect.left - 60, y: e.clientY - rect.top - 18 });
    if (!inPaper(e)) return;
    const n = topic.notes.find((x) => x.id === id);
    const s = material.find((x) => x.id === id);
    if (n) useNote(n, line);
    else if (s) useScrap(s, null, line);
  };

  const gripDown = (id: string) => (e: PointerEvent<HTMLDivElement>) => {
    const at = places[id];
    const rect = root.current?.getBoundingClientRect();
    if (!at || !rect) return;
    grab.current = { id, dx: e.clientX - rect.left - at.x, dy: e.clientY - rect.top - at.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    setOut((o) => [...o.filter((x) => x !== id), id]);
  };
  const gripMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    const rect = root.current?.getBoundingClientRect();
    if (!g || !rect) return;
    setPlaces((p) => ({ ...p, [g.id]: { x: e.clientX - rect.left - g.dx, y: Math.max(-10, e.clientY - rect.top - g.dy) } }));
  };

  const picked = (from: "draft" | string) => () => {
    const text = window.getSelection()?.toString().trim() ?? "";
    setSel(text ? { text, from } : null);
  };
  const park = () => {
    if (!sel) return;
    setMaterial((m) => [{ id: `m${Date.now()}`, kind: "From the draft", title: sel.text.slice(0, 40), body: sel.text, at: Date.now() }, ...m]);
    setSaid("Parked on the left.");
    setSel(null);
  };

  const frame = (id: string, cls: string, body: ReactNode) => {
    if (mode !== "float") return <div key={id} className={`dk-slot ${side(id)} ${mode} ${cls}`} onMouseUp={picked(id)}>{body}</div>;
    const at = places[id] ?? { x: 200, y: 30 };
    return (
      <div key={id} className={`dk-slot float ${cls}`} style={{ left: at.x, top: at.y, zIndex: 5 + out.indexOf(id) }} onMouseUp={picked(id)}>
        <div className="dk-grip" onPointerDown={gripDown(id)} onPointerMove={gripMove} onPointerUp={() => { grab.current = null; }}>
          <span className="eyebrow">Drag to move</span>
          <button type="button" className="btn quiet" onPointerDown={(e) => e.stopPropagation()} onClick={() => put(id)}>Put back</button>
        </div>
        {body}
      </div>
    );
  };
  const scrapCard = (s: Scrap) => {
    const part = sel?.from === s.id ? sel.text : null;
    return frame(s.id, "", <>
      <span className="eyebrow">{s.kind}</span>
      <b>{s.title}</b>
      <div style={{ whiteSpace: "pre-wrap" }}>{s.body}</div>
      <span className="faint">Select a part to pull only that into the draft.</span>
      <div className="row">
        <button type="button" className="btn pri" onClick={() => { useScrap(s, part); setSel(null); }}>
          {part ? "Pull the selection in" : "Pull into the draft"}
        </button>
        {mode !== "float" && <button type="button" className="btn quiet" onClick={() => put(s.id)}>Put back</button>}
      </div>
    </>);
  };
  const noteCard = (n: Note) => frame(n.id, "note", <>
    <span className="eyebrow">The assistant · {ago(n.at, now)}</span>
    {n.asks && <span className="dk-ask">{n.asks}</span>}
    <Md text={n.asks ? n.text.replace(`**${n.asks}**`, "").trimEnd() : n.text} />
    {waits.has(n.id) && n.kind === "note" && (
      <input
        type="text"
        placeholder="Answer in a sentence. Enter sends."
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && answer.trim()) { act.answer(n.id, answer.trim()); setAnswer(""); put(n.id); setSaid("Answered."); }
        }}
      />
    )}
    <div className="row">
      <button type="button" className="btn pri" onClick={() => useNote(n)}>Work it into the draft</button>
      {waits.has(n.id) && <button type="button" className="btn quiet" onClick={() => { act.dismiss(n.id); put(n.id); }}>Throw away</button>}
      {mode !== "float" && <button type="button" className="btn quiet" onClick={() => put(n.id)}>Put back</button>}
    </div>
  </>);
  const cards = out.map((id) => {
    const n = topic.notes.find((x) => x.id === id);
    const s = material.find((x) => x.id === id);
    return n ? noteCard(n) : s ? scrapCard(s) : null;
  });

  const history = [
    ...topic.notes.map((n) => ({ at: n.at, who: "them" as const, label: firstSentence(n.text), id: n.id as string | null })),
    ...topic.responses.map((r) => ({ at: r.at, who: "you" as const, label: r.text, id: null })),
    ...material.map((m) => ({ at: m.at, who: "mat" as const, label: m.title, id: m.id as string | null })),
  ].sort((a, b) => a.at - b.at);
  const mini = (id: string, cls: string, body: ReactNode) => (
    <button key={id} type="button" draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setTarget(null)} className={`dk-mini${cls}${out.includes(id) ? " on" : ""}${used.includes(id) ? " used" : ""}`} onClick={() => bring(id)}>
      {body}
    </button>
  );

  return (
    <>
      <div className="dk" ref={root} onDragOverCapture={dragOver} onDropCapture={drop}>
        <div className="dk-edge l">
          <span className="eyebrow">Material</span>
          {material.map((s) => mini(s.id, "", <><b>{s.title}</b>{s.kind} · {s.body.slice(0, 120)}</>))}
        </div>

        <div className="dk-mid">
          {mode !== "float" && cards}
          <div className="dk-paper" onMouseUp={picked("draft")}>
            <h2>{topic.question}</h2>
            <p className="dk-lead">{topic.stand}</p>
            <NoteEditor value={draft} label="Draft" hint="Write here. Select a passage to ask the assistant about it." place={null} onChange={setDraft} onLeave={() => {}} controller={page} assistantName="the assistant" askLabel="Ask the assistant" shortenLabel="Shorten" onAsk={(kind) => { act.think("think", "now"); setSaid(kind === "shorten" ? "The assistant is shortening that passage. Its proposal will appear on the right." : "The assistant is thinking about that passage. Its note will appear on the right."); }} />
          </div>
        </div>

        <div className="dk-edge r">
          <span className="eyebrow">From the assistant</span>
          {notes.map((n, i) => mini(n.id, waits.has(n.id) ? " waits" : i > 4 ? " far" : "", <><b>{n.asks ?? firstSentence(n.text)}</b>{ago(n.at, now)}</>))}
          {topic.runs.filter((r) => r.status === "pending").map((r) => (
            <button key={r.id} type="button" className="dk-mini waits" style={{ borderStyle: "dashed" }} onClick={() => act.land(r.id)}>
              <b>Thinking…</b>
              (prototype: click to let the note land)
            </button>
          ))}
        </div>

        {mode === "float" && cards}
      </div>

      <div className="dk-time" aria-label="History of this topic">
        {history.map((h, i) => (
          <button key={i} type="button" className={`dk-seg ${h.who}`} title={`${ago(h.at, now)}: ${h.label}`} onClick={() => h.id && !out.includes(h.id) && bring(h.id)} />
        ))}
      </div>
      <div className="dk-legend">
        <span>Topic opened</span>
        <span>{said || "Blue: the assistant thought. Green: you wrote. Amber: material arrived. Click a block to bring it back."}</span>
        <span>Now</span>
      </div>

      {sel?.from === "draft" && (
        <div className="dk-sel">
          <i>"{sel.text}"</i>
          <button type="button" onClick={() => { act.think("red-team", "now"); setSaid("The assistant is looking for holes in that passage. Its note will appear on the right."); setSel(null); }}>Find holes in this</button>
          <button type="button" onClick={park}>Park on the left</button>
        </div>
      )}
    </>
  );
}

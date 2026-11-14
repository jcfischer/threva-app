// PROTOTYPE, round 3: the Studio as a work desk on a wide screen, after Scott Jenson's Akademy talk (from 32:34).
// The thing you are making sits full size in the middle. Material is parked small on the left, the assistant's
// notes small on the right. Click one and it comes to the desk; drag it onto the draft and it lands on that line.
// Three ways a card opens, one per variant: over the draft (G), outwards over its own edge (H), or as a floating
// card you place anywhere and that stays there (I). Throwaway. The draft is not in the Cortex API today.
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from "react";
import { keptQuote } from "../everything/assistant";
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
.dk-slot.out{top:auto}
.dk-slot.float{top:auto;padding-top:0}
.dk-grip{cursor:move;margin:0 -18px;padding:9px 18px 7px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;user-select:none;touch-action:none;position:sticky;top:0;background:var(--panel)}
.dk-req{width:100%;max-width:240px;border:1px dashed var(--line);border-radius:8px;padding:7px 10px;font-size:12px;line-height:1.4;display:flex;flex-direction:column;gap:4px;align-items:flex-start;background:none;color:inherit;font-family:inherit;text-align:left}
.dk-req.failed{border-color:var(--wait)}
.dk-req.delivered{border-style:solid;border-color:var(--accent);cursor:pointer}
.dk-req .pill{font-size:11px}
.dk-req .btn{padding:3px 9px;font-size:12px}
.dk-doc{position:relative}
.dk-mark{position:absolute;right:-38px;width:26px;height:26px;border-radius:99px;border:1px solid var(--line);background:var(--panel);color:var(--dim);font-size:12px;cursor:pointer;display:grid;place-items:center;padding:0}
.dk-mark:hover{border-color:var(--accent);color:var(--accent)}
.dk-mark.q{border-color:var(--accent);color:var(--accent);font-weight:700}
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

/** One thing asked of the assistant, from the asking to the person closing it (after Flores: request, promise, delivery, acceptance). */
interface Req {
  id: string;
  what: "holes" | "ask";
  passage: string;
  state: "asked" | "promised" | "delivered" | "accepted" | "declined" | "failed";
  note?: string;
  reason?: string;
}

/** A passage of the draft and the card it came from or was asked about. */
interface Source {
  id: string;
  text: string;
  card: string | null;
  kind: "from" | "about";
}

const WHAT = { holes: "Find holes in", ask: "Ask me about" } as const;
const STATE = { asked: "Asked", promised: "Promised: in about a minute", delivered: "Delivered. Your turn.", accepted: "Accepted", declined: "Declined", failed: "Could not" } as const;
const QUESTIONS = {
  holes: ["What happens to this when the person arrives with forty things waiting?", "Who decides what counts here, and what if they decide wrong?", "What would have to be true for you to delete this sentence?"],
  ask: ["What do you mean by this, in words a newcomer would use?", "Which example from your material shows it?", "What is the opposite position, and who holds it?"],
} as const;

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
  const [requests, setRequests] = useState<Req[]>([{ id: "q0", what: "holes", passage: "The first three cards are chosen, not ranked.", state: "failed", reason: "The local model ran out of memory while reading the material." }]);
  const [sources, setSources] = useState<Source[]>([]);
  const [tops, setTops] = useState<{ [id: string]: number | null }>({});
  // Outwards: where each open card's parked twin sits, so the card opens beside it at the same height.
  const [anchors, setAnchors] = useState<{ [id: string]: Place & { w: number } }>({});
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
  useLayoutEffect(() => {
    if (mode !== "out") return;
    const measure = () => {
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      const next: { [id: string]: Place & { w: number } } = {};
      for (const id of out) {
        const twin = root.current?.querySelector(`[data-card="${id}"]`)?.getBoundingClientRect();
        if (!twin) continue;
        // As wide as the space outside the column allows, between 280 and 380.
        const right = topic.notes.some((n) => n.id === id);
        const room = right ? box.width + 20 - (twin.right - box.left + 12) : twin.left - box.left - 12 + 20;
        const w = Math.max(280, Math.min(380, room));
        // On a screen too narrow for that, the card stays on screen and overlaps its own column.
        next[id] = { x: right ? Math.min(box.width + 20 - w, twin.right - box.left + 12) : Math.max(-20, twin.left - box.left - 12 - w), y: twin.top - box.top, w };
      }
      setAnchors((now) => (JSON.stringify(now) === JSON.stringify(next) ? now : next));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [mode, out, topic.notes, material, requests]);
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

  const settle = (req: string, state: Req["state"], extra: Partial<Req> = {}) => setRequests((rs) => rs.map((r) => (r.id === req ? { ...r, state, ...extra } : r)));
  const closeFor = (noteId: string, state: "accepted" | "declined") => setRequests((rs) => rs.map((r) => (r.note === noteId && r.state === "delivered" ? { ...r, state } : r)));
  const request = (what: Req["what"], passage: string) => {
    const id = `q${Date.now()}`;
    const text = passage.trim().split("\n")[0] ?? "";
    setRequests((rs) => [{ id, what, passage: text, state: "asked" }, ...rs]);
    setSources((s) => [...s, { id, text, card: null, kind: "about" }]);
    setSaid("Asked. The assistant answers with questions, never with a rewrite.");
    setTimeout(() => setRequests((rs) => rs.map((r) => (r.id === id && r.state === "asked" ? { ...r, state: "promised" } : r))), 900);
  };
  const deliver = (r: Req) => {
    const id = `n${Date.now()}`;
    const head = `Three questions about "${bare(r.passage).slice(0, 48)}${r.passage.length > 48 ? "…" : ""}"`;
    act.deliver({ id, at: Date.now(), kind: "note", status: "open", mode: r.what === "holes" ? "red-team" : "grill", trigger: "You asked", model: "Qwen 3.8 27B (local)", asks: head, text: QUESTIONS[r.what].map((q, i) => `${i + 1}. ${q}`).join("\n") });
    settle(r.id, "delivered", { note: id });
    setSources((s) => s.map((x) => (x.id === r.id ? { ...x, card: id } : x)));
  };

  // The assistant never writes as you: its words arrive as a marked quote, tied to the card they came from.
  const add = (quote: string, first: string, from: string, after: string | null) => {
    page.current?.apply((text) => withLine(text, quote, after));
    setUsed((u) => [...u, from]);
    setSources((s) => [...s, { id: `s${Date.now()}`, text: first, card: from, kind: "from" }]);
    setSaid("Added as a quote with its source. Rewrite it in your own words.");
  };
  const useNote = (n: Note, after: string | null = null) => {
    const text = firstSentence(n.text.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? n.text).replace(/^\d+\.\s*/, "");
    add(keptQuote("The assistant", new Date(n.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), text), text, n.id, after);
    if (n.kind === "note") act.answer(n.id, "(worked into the draft)");
    else act.keep(n.id);
    closeFor(n.id, "accepted");
    put(n.id);
  };
  const useScrap = (s: Scrap, text: string | null = null, after: string | null = null) => {
    const body = text ?? s.body.split("\n").pop() ?? s.body;
    add(keptQuote(s.title, s.kind.toLowerCase(), body), body.split("\n")[0] ?? body, s.id, after);
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
    if (mode === "over") return <div key={id} className={`dk-slot ${side(id)} over ${cls}`} onMouseUp={picked(id)}>{body}</div>;
    if (mode === "out") {
      const beside = anchors[id];
      return beside ? <div key={id} className={`dk-slot out ${cls}`} style={{ left: beside.x, top: beside.y, width: beside.w }} onMouseUp={picked(id)}>{body}</div> : null;
    }
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
          if (e.key === "Enter" && answer.trim()) { act.answer(n.id, answer.trim()); closeFor(n.id, "accepted"); setAnswer(""); put(n.id); setSaid("Answered."); }
        }}
      />
    )}
    <div className="row">
      <button type="button" className="btn pri" onClick={() => useNote(n)}>Work it into the draft</button>
      {waits.has(n.id) && <button type="button" className="btn quiet" onClick={() => { act.dismiss(n.id); closeFor(n.id, "declined"); put(n.id); }}>Throw away</button>}
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
    <button key={id} type="button" data-card={id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setTarget(null)} className={`dk-mini${cls}${out.includes(id) ? " on" : ""}${used.includes(id) ? " used" : ""}`} onClick={() => bring(id)}>
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
          {mode === "over" && cards}
          <div className="dk-paper" onMouseUp={picked("draft")}>
            <h2>{topic.question}</h2>
            <p className="dk-lead">{topic.stand}</p>
            <div className="dk-doc">
              <NoteEditor value={draft} label="Draft" hint="Write here. Select a passage to have the assistant question it." place={null} onChange={setDraft} onLeave={() => {}} controller={page} assistantName="the assistant" shortenLabel="Find holes in this" askLabel="Ask me about this" passages={sources} onPassages={setTops} onAsk={(kind, passage) => request(kind === "shorten" ? "holes" : "ask", passage)} />
              {sources.map((s) => {
                const top = tops[s.id];
                if (top === null || top === undefined) return null;
                const pending = s.kind === "about" && !s.card;
                return (
                  <button key={s.id} type="button" className={`dk-mark${s.kind === "about" ? " q" : ""}`} style={{ top }} title={pending ? "Asked. Not delivered yet." : s.kind === "about" ? "The assistant's questions about this passage" : "Where this came from"} onClick={() => s.card && !out.includes(s.card) && bring(s.card)}>
                    {pending ? "…" : s.kind === "about" ? "?" : "↗"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="dk-edge r">
          {requests.some((r) => r.state !== "accepted" && r.state !== "declined") && <span className="eyebrow">Asked of the assistant</span>}
          {requests.filter((r) => r.state !== "accepted" && r.state !== "declined").map((r) => (
            <div key={r.id} className={`dk-req ${r.state}`} onClick={() => r.state === "delivered" && r.note && !out.includes(r.note) && bring(r.note)}>
              <span>{WHAT[r.what]} "{bare(r.passage).slice(0, 60)}{r.passage.length > 60 ? "…" : ""}"</span>
              <span className={`pill ${r.state === "failed" ? "wait" : r.state === "delivered" ? "think" : "calm"}`}>{STATE[r.state]}</span>
              {r.state === "failed" && <span>{r.reason}</span>}
              {r.state === "failed" && <button type="button" className="btn" onClick={() => { settle(r.id, "asked"); setTimeout(() => settle(r.id, "promised"), 900); }}>Try again</button>}
              {r.state === "promised" && <button type="button" className="btn quiet" onClick={() => deliver(r)}>(prototype: deliver now)</button>}
            </div>
          ))}
          {requests.some((r) => r.state === "accepted" || r.state === "declined") && (
            <span className="faint" style={{ fontSize: 12 }}>
              Closed: {requests.filter((r) => r.state === "accepted").length} accepted, {requests.filter((r) => r.state === "declined").length} declined
            </span>
          )}
          <span className="eyebrow">From the assistant</span>
          {notes.map((n, i) => mini(n.id, waits.has(n.id) ? " waits" : i > 4 ? " far" : "", <><b>{n.asks ?? firstSentence(n.text)}</b>{ago(n.at, now)}</>))}
        </div>

        {mode !== "over" && cards}
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
          <button type="button" onClick={park}>Park on the left</button>
        </div>
      )}
    </>
  );
}

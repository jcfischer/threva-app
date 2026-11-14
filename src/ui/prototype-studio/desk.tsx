// PROTOTYPE, round 3: the Studio as a work desk on a wide screen, after Scott Jenson's Akademy talk (from 32:34).
// The thing you are making sits full size in the middle. Material is parked small on the left, the assistant's
// notes small on the right. Click one and it comes to the desk beside the work; drag it onto the work to use it.
// Select text in the work to act on that passage. The strip at the bottom is the topic's history.
// Throwaway. The draft is not in the Cortex API today: a work document per topic is a gap.
import { useEffect, useRef, useState, type DragEvent } from "react";
import { NoteEditor, type PageController } from "../everything/editor";
import { ago, firstSentence, waiting, type Note, type Topic } from "./data";
import { Md, type Acts } from "./prototype";

export const DESK_CSS = `
.dk{display:grid;grid-template-columns:minmax(170px,1fr) minmax(480px,720px) minmax(170px,1fr);gap:18px;align-items:start}
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
.dk-paper{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:38px 46px 60px;box-shadow:0 10px 40px rgba(0,0,0,.18);min-height:70vh}
.dk-paper.over{outline:2px dashed var(--accent);outline-offset:4px}
.dk-paper h2{font-size:23px;line-height:1.25;margin:0 0 6px}
.dk-lead{font-size:16.5px;color:var(--dim);border-left:3px solid var(--accent);padding-left:12px;margin:10px 0 22px}
.dk-block{margin:0 0 12px;font-size:16px;line-height:1.6;outline:none;border-radius:4px}
.dk-block.h{font-weight:650;font-size:17px;margin-top:20px}
.dk-block.quote{border-left:3px solid var(--line);padding-left:12px;color:var(--dim)}
.dk-block.fresh{background:var(--accent-soft);box-shadow:0 0 0 6px var(--accent-soft)}
.dk-block:focus{background:var(--sunk);box-shadow:0 0 0 6px var(--sunk)}
.dk-mid{position:relative}
.dk-slot{width:380px;border:1px solid var(--line);border-radius:6px;background:var(--panel);padding:16px 18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 40px rgba(0,0,0,.18);position:absolute;top:34px;z-index:5;max-height:78vh;overflow:auto;box-shadow:0 18px 60px rgba(0,0,0,.45)}
.dk-slot.l{left:-28px}
.dk-slot.r{right:-28px}
.dk-paper .note-editor{border:0;border-radius:0;overflow:visible}
.dk-paper .note-editor .cm-scroller{max-height:none;padding:0;font-size:16px;line-height:1.65}
.dk-slot.note{border-color:var(--accent)}
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
@media (max-width:1100px){.dk{grid-template-columns:minmax(0,1fr)}.dk-edge.l,.dk-edge.r{align-items:stretch}.dk-slot{position:static;width:auto}}
`;

interface Scrap {
  id: string;
  title: string;
  kind: string;
  body: string;
  at: number;
}

const DAY = 86_400_000;

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

type OnDesk = { side: "l"; scrap: Scrap } | { side: "r"; note: Note } | null;

export function Desk({ topic, act, now }: { topic: Topic; act: Acts; now: number }) {
  const [draft, setDraft] = useState(DRAFT);
  const [material, setMaterial] = useState(() => scraps(now));
  const [left, setLeft] = useState<Scrap | null>(null);
  const [right, setRight] = useState<Note | null>(null);
  const [used, setUsed] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [sel, setSel] = useState("");
  const [answer, setAnswer] = useState("");
  const [said, setSaid] = useState("");

  const open = new Set(waiting(topic).map((n) => n.id));
  const notes = topic.notes.filter((n) => n.status !== "dismissed").sort((a, b) => b.at - a.at);
  const note = right ? (topic.notes.find((n) => n.id === right.id) ?? null) : null;

  const page = useRef<PageController | null>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setLeft(null); setRight(null); } };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  const add = (kind: "p" | "quote", text: string, from: string) => {
    const line = kind === "quote" ? `> ${text.replace(/\n/g, "\n> ")}` : text;
    page.current?.apply((now) => `${now.trimEnd()}\n\n${line}\n`);
    setUsed((u) => [...u, from]);
    setSaid("Added at the end of the draft. Edit it like any other line.");
  };
  const useNote = (n: Note) => {
    add("p", firstSentence(n.text.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? n.text), n.id);
    if (n.kind === "note") act.answer(n.id, "(worked into the draft)");
    else act.keep(n.id);
    setRight(null);
  };
  const useScrap = (s: Scrap, text = s.body.split("\n").pop() ?? s.body) => add("quote", text, s.id);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const id = e.dataTransfer.getData("text/plain");
    const n = topic.notes.find((x) => x.id === id);
    const s = material.find((x) => x.id === id);
    if (n) useNote(n);
    else if (s) useScrap(s);
  };
  const picked = () => setSel(window.getSelection()?.toString().trim() ?? "");
  const park = () => {
    setMaterial((m) => [{ id: `m${Date.now()}`, kind: "From the draft", title: sel.slice(0, 40), body: sel, at: Date.now() }, ...m]);
    setSaid("Parked on the left.");
    setSel("");
  };
  const askAbout = (mode: "think" | "red-team") => {
    act.think(mode, "now");
    setSaid(mode === "think" ? "The assistant is thinking about that passage. Its note will appear on the right." : "The assistant is looking for holes in that passage. Its note will appear on the right.");
    setSel("");
  };
  const history = [
    ...topic.notes.map((n) => ({ at: n.at, who: "them" as const, label: firstSentence(n.text), note: n })),
    ...topic.responses.map((r) => ({ at: r.at, who: "you" as const, label: r.text, note: null })),
    ...material.map((m) => ({ at: m.at, who: "mat" as const, label: m.title, note: null })),
  ].sort((a, b) => a.at - b.at);

  return (
    <>
      <div className="dk">
        <div className="dk-edge l">
          <span className="eyebrow">Material</span>
          {material.map((s) => (
            <button key={s.id} type="button" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)} className={`dk-mini${left?.id === s.id ? " on" : ""}${used.includes(s.id) ? " used" : ""}`} onClick={() => setLeft(left?.id === s.id ? null : s)}>
              <b>{s.title}</b>
              {s.kind} · {s.body.slice(0, 120)}
            </button>
          ))}
        </div>

        <div className="dk-mid">
        {left && (
          <div className="dk-slot l" onMouseUp={picked}>
            <span className="eyebrow">{left.kind}</span>
            <b>{left.title}</b>
            <div style={{ whiteSpace: "pre-wrap" }}>{left.body}</div>
            <span className="faint">Select a part to pull only that into the draft.</span>
            <div className="row">
              <button type="button" className="btn pri" onClick={() => { useScrap(left, sel || undefined); setSel(""); setLeft(null); }}>
                {sel ? "Pull the selection in" : "Pull into the draft"}
              </button>
              <button type="button" className="btn quiet" onClick={() => setLeft(null)}>
                Put back
              </button>
            </div>
          </div>
        )}

        <div className={`dk-paper${over ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop} onMouseUp={picked}>
          <h2>{topic.question}</h2>
          <p className="dk-lead">{topic.stand}</p>
          <NoteEditor value={draft} label="Draft" hint="Write here. Select a passage to ask the assistant about it." place={null} onChange={setDraft} onLeave={() => {}} controller={page} assistantName="the assistant" askLabel="Ask the assistant" shortenLabel="Shorten" onAsk={(kind) => { act.think("think", "now"); setSaid(kind === "shorten" ? "The assistant is shortening that passage. Its proposal will appear on the right." : "The assistant is thinking about that passage. Its note will appear on the right."); }} />
        </div>

        {note && (
          <div className="dk-slot r note">
            <span className="eyebrow">The assistant · {ago(note.at, now)}</span>
            {note.asks && <span className="dk-ask">{note.asks}</span>}
            <Md text={note.asks ? note.text.replace(`**${note.asks}**`, "").trimEnd() : note.text} />
            {open.has(note.id) && note.kind === "note" && (
              <input
                type="text"
                placeholder="Answer in a sentence. Enter sends."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && answer.trim()) { act.answer(note.id, answer.trim()); setAnswer(""); setRight(null); setSaid("Answered."); }
                }}
              />
            )}
            <div className="row">
              <button type="button" className="btn pri" onClick={() => useNote(note)}>
                Work it into the draft
              </button>
              {open.has(note.id) && (
                <button type="button" className="btn quiet" onClick={() => { act.dismiss(note.id); setRight(null); }}>
                  Throw away
                </button>
              )}
              <button type="button" className="btn quiet" onClick={() => setRight(null)}>
                Put back
              </button>
            </div>
          </div>
        )}
        </div>

        <div className="dk-edge r">
          <span className="eyebrow">From the assistant</span>
          {notes.map((n, i) => (
            <button key={n.id} type="button" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", n.id)} className={`dk-mini${open.has(n.id) ? " waits" : i > 4 ? " far" : ""}${note?.id === n.id ? " on" : ""}${used.includes(n.id) ? " used" : ""}`} onClick={() => setRight(note?.id === n.id ? null : n)}>
              <b>{n.asks ?? firstSentence(n.text)}</b>
              {ago(n.at, now)}
            </button>
          ))}
          {topic.runs.filter((r) => r.status === "pending").map((r) => (
            <button key={r.id} type="button" className="dk-mini waits" style={{ borderStyle: "dashed" }} onClick={() => act.land(r.id)}>
              <b>Thinking…</b>
              (prototype: click to let the note land)
            </button>
          ))}
        </div>
      </div>

      <div className="dk-time" aria-label="History of this topic">
        {history.map((h, i) => (
          <button key={i} type="button" className={`dk-seg ${h.who}`} title={`${ago(h.at, now)}: ${h.label}`} onClick={() => h.note && setRight(h.note)} />
        ))}
      </div>
      <div className="dk-legend">
        <span>Topic opened</span>
        <span>{said || "Blue: the assistant thought. Green: you wrote. Amber: material arrived. Click a block to bring it back."}</span>
        <span>Now</span>
      </div>

      {sel && !left && (
        <div className="dk-sel">
          <i>"{sel}"</i>
          <button type="button" onClick={() => askAbout("red-team")}>Find holes in this</button>
          <button type="button" onClick={park}>Park on the left</button>
        </div>
      )}
    </>
  );
}

// PROTOTYPE for the Studio redesign (docs/design/studio-redesign.md): three variants of the answerable Day card and
// the topic page, switchable via ?prototype=studio&variant=A|B|C&screen=day|page. Throwaway. Writes are stubs in memory.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Header } from "../app";
import { Desk, DESK_CSS, type DeskMode } from "./desk";
import { One, Sentence, SIMPLE_CSS, Talk } from "./simple";
import { ago, dayOf, firstLine, firstSentence, fixture, MODES, modeLabel, record, waiting, type Mode, type Note, type Topic } from "./data";

const VARIANTS = [
  ["G", "Desk, cards open over the draft"],
  ["H", "Desk, cards open outwards"],
  ["I", "Desk, cards float and stay"],
  ["D", "One question"],
  ["E", "Just talk"],
  ["F", "The sentence"],
  ["A", "One column, one composer"],
  ["B", "Page and margin"],
  ["C", "Waiting first, record behind"],
] as const;
type Key = (typeof VARIANTS)[number][0];
type Screen = "day" | "page";

const CSS = `
.px-switch{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:#111;color:#fff;border-radius:99px;padding:6px 10px;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,.35);z-index:50}
.px-switch button{background:#333;color:#fff;border:0;border-radius:99px;min-width:28px;height:28px;padding:0 9px;cursor:pointer}
.px-switch button.on{background:#fff;color:#111}
.px .btn,.px-meta button,.px-switch,.px-tabs button{white-space:nowrap}
.px-state{font-family:var(--mono);font-size:12px;color:var(--faint);border:1px dashed var(--line);border-radius:8px;padding:6px 10px}
.px-md h4{margin:0 0 4px;font-size:15px}
.px-md p{margin:0 0 8px}
.px-md ul,.px-md ol{margin:0 0 8px;padding-left:20px}
.px-md>:last-child{margin-bottom:0}
.px-meta{font-size:12.5px;color:var(--faint)}
.px-meta button{background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit}
.px-stand{border-left:3px solid var(--accent);padding:2px 0 2px 12px}
.px-stand p{margin:2px 0 0;font-size:15.5px}
.px-hist{font-size:13.5px;color:var(--dim);margin:6px 0 0;padding-left:18px}
.px-hist li{margin:2px 0}
.px-open{border:1px solid var(--accent);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;background:var(--panel)}
.px-asks{font-weight:600;font-size:16px}
.px-day{font-size:12px;font-weight:600;color:var(--faint);margin:10px 0 2px}
.px-line{display:flex;gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line);cursor:pointer;background:none;border-width:0 0 1px;width:100%;text-align:left;font:inherit;color:inherit}
.px-line .who{flex:0 0 74px;font-size:12.5px;color:var(--faint)}
.px-line .txt{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-line.gone .txt{text-decoration:line-through;color:var(--faint)}
.px-full{padding:8px 0 12px 84px;border-bottom:1px solid var(--line)}
.px-composer{position:sticky;bottom:64px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;box-shadow:0 4px 18px rgba(0,0,0,.08);display:flex;flex-direction:column;gap:8px}
.px-tabs{display:flex;gap:4px}
.px-tabs button{background:none;border:0;border-bottom:2px solid transparent;padding:4px 8px;font:inherit;font-weight:600;color:var(--dim);cursor:pointer}
.px-tabs button.on{color:var(--accent);border-color:var(--accent)}
.px-opt{display:flex;gap:8px;align-items:baseline;padding:5px 8px;border-radius:8px;cursor:pointer}
.px-opt:hover,.px-opt.on{background:var(--accent-soft)}
.px-opt input{width:auto;flex:none;margin:0}
.px-opt b{font-weight:600}
.px-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,330px);gap:28px;align-items:start}
.px-two{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:22px;align-items:start}
@media (max-width:900px){.px-grid,.px-two{grid-template-columns:minmax(0,1fr)}}
.px-doc p{margin:0 0 4px}
.px-doc .entry{margin:0 0 16px;max-width:68ch}
.px-doc .you{border-left:3px solid var(--line);padding-left:12px}
.px-clamp{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.px-run{font-size:13.5px;color:var(--dim);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.px-run.failed{color:var(--wait)}
.px-pop{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel);display:flex;flex-direction:column;gap:6px}
.px-chat{display:flex;flex-direction:column;gap:6px;font-size:14.5px}
.px-chat .you{align-self:flex-end;background:var(--accent-soft);border-radius:10px;padding:5px 10px}
.px-chat .assistant{align-self:flex-start;background:var(--sunk);border-radius:10px;padding:5px 10px}
.px-daycol{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:10px;width:100%}
`;

// --- stub acts: every one returns the next topic and says what happened ---

type Set = (fn: (t: Topic) => Topic) => void;

const acts = (set: Set) => ({
  answer: (note: string | undefined, text: string) =>
    set((t) => ({ ...t, responses: [...t.responses, { id: `r${Date.now()}`, at: Date.now(), ...(note ? { re: note } : {}), text }], last: `answered ${note ?? "the topic"}` })),
  keep: (id: string) =>
    set((t) => {
      const note = t.notes.find((n) => n.id === id);
      const notes = t.notes.map((n) => (n.id === id ? { ...n, status: "kept" as const } : n));
      if (note?.kind !== "stand") return { ...t, notes, last: `kept ${id}` };
      return { ...t, notes, stand: note.text, standHistory: [{ at: Date.now(), text: t.stand }, ...t.standHistory], last: `kept ${id} as the new stand` };
    }),
  dismiss: (id: string) => set((t) => ({ ...t, notes: t.notes.map((n) => (n.id === id ? { ...n, status: "dismissed" as const } : n)), last: `dismissed ${id}` })),
  think: (mode: Mode, when: "now" | "tonight") =>
    set((t) => ({ ...t, runs: [...t.runs.filter((r) => r.mode !== mode), { id: `run${Date.now()}`, mode, when, status: "pending" }], last: `queued "${modeLabel(mode)}" for ${when}` })),
  land: (run: string) =>
    set((t) => {
      const r = t.runs.find((x) => x.id === run);
      if (!r) return t;
      const note: Note = { id: `n${Date.now()}`, at: Date.now(), kind: "note", status: "open", mode: r.mode, trigger: "You asked", model: "Qwen 3.8 27B (local)", text: `(Sample answer for "${modeLabel(r.mode)}".) The staged first day works only if the three cards are real. A fake card teaches distrust.` };
      return { ...t, runs: t.runs.filter((x) => x.id !== run), notes: [note, ...t.notes], last: `the answer to "${modeLabel(r.mode)}" landed as a note` };
    }),
  ask: (text: string) =>
    set((t) => ({ ...t, chat: [...t.chat, { who: "you", text }, { who: "assistant", text: "(Sample reply.) Short answer: the assistant's own card first. It is the only card no other product has." }], last: "asked now" })),
  setStand: (text: string) => set((t) => ({ ...t, stand: text, standHistory: [{ at: Date.now(), text: t.stand }, ...t.standHistory], last: "rewrote the stand" })),
  propose: () =>
    set((t) => ({
      ...t,
      notes: [{ id: `n${Date.now()}`, at: Date.now(), kind: "stand", status: "open", mode: "think", trigger: "You answered", model: "Qwen 3.8 27B (local)", text: "(Sample rewrite.) Show the assistant's own card first, then one card at a time, and explain nothing up front." }, ...t.notes],
      last: `${t.last}; the assistant proposed a rewrite`,
    })),
  state: (state: Topic["state"]) => set((t) => ({ ...t, state, last: `topic ${state}` })),
});
export type Acts = ReturnType<typeof acts>;

// --- small shared parts ---

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
}

export function Md({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    list = null;
  };
  for (const line of text.split("\n")) {
    const bullet = /^[-*]\s+(.*)/.exec(line);
    const number = /^\d+\.\s+(.*)/.exec(line);
    if (bullet || number) {
      list ??= { ordered: !!number, items: [] };
      list.items.push((bullet ?? number)![1]!);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    out.push(line.startsWith("#") ? <h4 key={out.length}>{line.replace(/^#+\s*/, "")}</h4> : <p key={out.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="px-md">{out}</div>;
}

const KIND = { note: "Note", stand: "Proposal for your stand", idea: "Idea" } as const;

/** Q7: relative time and the mode. The rest sits behind "details". */
function Meta({ note, now }: { note: Note; now: number }) {
  const [more, setMore] = useState(false);
  return (
    <span className="px-meta">
      {KIND[note.kind]} · {ago(note.at, now)} · {modeLabel(note.mode)} ·{" "}
      <button type="button" onClick={(e) => { e.stopPropagation(); setMore(!more); }}>
        {more ? "less" : "details"}
      </button>
      {more && <> · {note.model} · started by: {note.trigger} · {new Date(note.at).toLocaleString("en-GB")}</>}
    </span>
  );
}

function Stand({ topic, now }: { topic: Topic; now: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-stand">
      <span className="eyebrow">Where I stand</span>
      <p>{topic.stand}</p>
      <span className="px-meta">
        <button type="button" onClick={() => setOpen(!open)}>
          {open ? "Hide earlier versions" : `Changed ${topic.standHistory.length} times`}
        </button>
      </span>
      {open && (
        <ul className="px-hist">
          {topic.standHistory.map((v, i) => (
            <li key={i}>
              {ago(v.at, now)}: {v.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Runs({ topic, act }: { topic: Topic; act: Acts }) {
  return (
    <>
      {topic.runs.map((run) =>
        run.status === "failed" ? (
          <span key={run.id} className="px-run failed">
            "{modeLabel(run.mode)}" did not finish. {run.reason}
            <button type="button" className="btn" onClick={() => act.think(run.mode, "now")}>
              Try again
            </button>
          </span>
        ) : (
          <span key={run.id} className="px-run">
            The assistant is {run.when === "tonight" ? "going to work on" : "working on"} "{modeLabel(run.mode)}"{run.when === "tonight" ? " tonight" : ""}. The answer lands here as a note.
            <button type="button" className="btn quiet" onClick={() => act.land(run.id)}>
              (prototype: let it land)
            </button>
          </span>
        ),
      )}
    </>
  );
}

/** Q6: plain options under one question, plus now or tonight. */
function ThinkMenu({ act, onDone }: { act: Acts; onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>("think");
  const [when, setWhen] = useState<"now" | "tonight">("now");
  return (
    <div className="stack" style={{ gap: 4 }}>
      <span className="eyebrow">What do you want from the assistant?</span>
      {MODES.map((m) => (
        <label key={m.mode} className={`px-opt${mode === m.mode ? " on" : ""}`}>
          <input type="radio" name="px-mode" checked={mode === m.mode} onChange={() => setMode(m.mode)} />
          <span>
            <b>{m.label}</b> <span className="faint">{m.hint}</span>
          </span>
        </label>
      ))}
      <div className="row" style={{ marginTop: 4 }}>
        <label className="px-opt">
          <input type="radio" name="px-when" checked={when === "now"} onChange={() => setWhen("now")} /> Now, in the background
        </label>
        <label className="px-opt">
          <input type="radio" name="px-when" checked={when === "tonight"} onChange={() => setWhen("tonight")} /> Tonight
        </label>
        <button type="button" className="btn pri" onClick={() => { act.think(mode, when); onDone?.(); }}>
          Think about it
        </button>
      </div>
      <span className="faint">You don't wait. The answer lands on this topic as a note.</span>
    </div>
  );
}

function AskNow({ topic, act, about }: { topic: Topic; act: Acts; about?: string }) {
  const [text, setText] = useState("");
  const send = () => { if (text.trim()) { act.ask(text.trim()); setText(""); } };
  return (
    <div className="stack">
      {about && <span className="faint">About: {about}</span>}
      <div className="px-chat">
        {topic.chat.map((line, i) => (
          <span key={i} className={line.who}>
            {line.text}
          </span>
        ))}
      </div>
      <div className="row">
        <input type="text" style={{ flex: 1 }} placeholder="Ask the assistant. It answers right here." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button type="button" className="btn pri" disabled={!text.trim()} onClick={send}>
          Ask now
        </button>
      </div>
    </div>
  );
}

function AnswerBox({ note, act, rows = 3 }: { note: Note | undefined; act: Acts; rows?: number }) {
  const [text, setText] = useState("");
  return (
    <div className="stack">
      <textarea rows={rows} placeholder={note ? "Your answer. It goes into the topic's record." : "Nothing waits for an answer."} disabled={!note} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row">
        <button type="button" className="btn pri" disabled={!note || !text.trim()} onClick={() => { act.answer(note?.id, text.trim()); setText(""); }}>
          Answer
        </button>
      </div>
    </div>
  );
}

function KeepDismiss({ note, act }: { note: Note; act: Acts }) {
  if (note.kind === "note") return null;
  return (
    <>
      <button type="button" className="btn" onClick={() => act.keep(note.id)}>
        {note.kind === "stand" ? "Make this my stand" : "Keep"}
      </button>
      <button type="button" className="btn quiet" onClick={() => act.dismiss(note.id)}>
        Dismiss
      </button>
    </>
  );
}

/** Q10: park and finish in the header. Finishing asks for the outcome in one step. */
function HeaderActions({ topic, act, children }: { topic: Topic; act: Acts; children?: ReactNode }) {
  const [closing, setClosing] = useState(false);
  const [outcome, setOutcome] = useState("decided");
  return (
    <div className="stack" style={{ alignItems: "flex-end" }}>
      <span className="row" style={{ flexWrap: "nowrap" }}>
        {children}
        <button type="button" className="btn quiet" onClick={() => act.state(topic.state === "parked" ? "active" : "parked")}>
          {topic.state === "parked" ? "Take it up again" : "Park"}
        </button>
        <button type="button" className="btn quiet" onClick={() => setClosing(!closing)}>
          Finish…
        </button>
      </span>
      {closing && (
        <div className="px-pop" style={{ minWidth: 320 }}>
          <span className="row">
            {["decided", "shipped", "dropped"].map((o) => (
              <label key={o} className="px-opt">
                <input type="radio" name="px-out" checked={outcome === o} onChange={() => setOutcome(o)} /> {o[0]!.toUpperCase() + o.slice(1)}
              </label>
            ))}
          </span>
          <textarea rows={2} placeholder="What came of it?" />
          <button type="button" className="btn pri" onClick={() => { act.state("closed"); setClosing(false); }}>
            Finish the topic
          </button>
        </div>
      )}
    </div>
  );
}

function Title({ topic, right }: { topic: Topic; right: ReactNode }) {
  const turn = waiting(topic).length > 0;
  return (
    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
      <div className="stack" style={{ gap: 2, flex: 1, minWidth: 260 }}>
        <span className="row">
          <span className="eyebrow">Topic</span>
          {topic.state !== "active" && <span className="pill calm">{topic.state}</span>}
          {turn && <span className="pill think">Your turn</span>}
        </span>
        <h2 className="stq">{topic.question}</h2>
      </div>
      {right}
    </div>
  );
}

function Material({ topic }: { topic: Topic }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <span className="eyebrow">Material</span>
      {topic.material.map((m, i) => (
        <span key={i}>
          <a className="lk" href="#">{m.label}</a> <span className="faint">{m.why}</span>
        </span>
      ))}
      <span className="px-meta"><button type="button">Add material</button></span>
    </div>
  );
}

/** Q4: the record grouped by day, each entry collapsed to one line. `collapse` picks the rule under test. */
export function Record({ topic, now, collapse }: { topic: Topic; now: number; collapse: (text: string) => string }) {
  const [open, setOpen] = useState<string | null>(null);
  let day = "";
  return (
    <div>
      {record(topic).map((e) => {
        const id = "note" in e ? e.note.id : e.response.id;
        const text = "note" in e ? e.note.text : e.response.text;
        const label = dayOf(e.at, now);
        const head = label !== day ? ((day = label), <div className="px-day">{label}</div>) : null;
        const gone = "note" in e && e.note.status === "dismissed";
        return (
          <div key={id}>
            {head}
            <button type="button" className={`px-line${gone ? " gone" : ""}`} onClick={() => setOpen(open === id ? null : id)}>
              <span className="who">{"note" in e ? "Assistant" : "You"}</span>
              <span className="txt">{collapse(text)}</span>
              {"note" in e && e.note.kind === "stand" && <span className="pill calm">stand</span>}
            </button>
            {open === id && (
              <div className="px-full stack">
                <Md text={text} />
                {"note" in e && <Meta note={e.note} now={now} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface P {
  topic: Topic;
  act: Acts;
  now: number;
  goPage: () => void;
}

// --- Variant A: one column, one composer with the three verbs as tabs ---

function DayA({ topic, act, now, goPage }: P) {
  const note = waiting(topic)[0];
  if (!note) return <DayDone goPage={goPage} />;
  return (
    <div className="card">
      <span className="row" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">Topic</span>
        <span className="pill think">Your turn</span>
      </span>
      <span className="q">{topic.question}</span>
      <div className="px-open">
        <Md text={note.text} />
        <Meta note={note} now={now} />
      </div>
      <AnswerBox note={note} act={act} />
      <div className="row">
        <KeepDismiss note={note} act={act} />
        <button type="button" className="btn quiet" onClick={goPage}>
          Open the topic
        </button>
      </div>
    </div>
  );
}

function PageA({ topic, act, now }: P) {
  const open = waiting(topic);
  const [tab, setTab] = useState<"answer" | "ask" | "think">("answer");
  const [target, setTarget] = useState<string | null>(null);
  const note = open.find((n) => n.id === target) ?? open[0];
  return (
    <div className="stack" style={{ gap: 18 }}>
      <Title topic={topic} right={<HeaderActions topic={topic} act={act} />} />
      <Stand topic={topic} now={now} />
      {open.length > 0 && (
        <div className="stack">
          <span className="eyebrow">Waiting for you · {open.length}</span>
          {open.map((n) => (
            <div key={n.id} className="px-open" style={n.id === note?.id && tab === "answer" ? { boxShadow: "0 0 0 2px var(--accent-soft)" } : undefined}>
              <Md text={n.text} />
              <Meta note={n} now={now} />
              <div className="row">
                <button type="button" className="btn pri" onClick={() => { setTarget(n.id); setTab("answer"); }}>
                  Answer
                </button>
                <KeepDismiss note={n} act={act} />
              </div>
            </div>
          ))}
        </div>
      )}
      <Runs topic={topic} act={act} />
      <div className="stack" style={{ gap: 0 }}>
        <span className="eyebrow">Earlier</span>
        <Record topic={topic} now={now} collapse={firstLine} />
      </div>
      <Material topic={topic} />
      <div className="px-composer">
        <div className="px-tabs">
          {([["answer", "Answer"], ["ask", "Ask now"], ["think", "Think about it"]] as const).map(([k, label]) => (
            <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
        {tab === "answer" && (
          <>
            {note && <span className="faint">To: {firstSentence(note.asks ?? note.text)}</span>}
            <AnswerBox note={note} act={act} rows={2} />
          </>
        )}
        {tab === "ask" && <AskNow topic={topic} act={act} />}
        {tab === "think" && <ThinkMenu act={act} />}
      </div>
    </div>
  );
}

// --- Variant B: the record is a document, open notes sit in the margin, verbs in the header ---

function DayB({ topic, act, now, goPage }: P) {
  const note = waiting(topic)[0];
  const [answering, setAnswering] = useState(false);
  if (!note) return <DayDone goPage={goPage} />;
  return (
    <div className="card">
      <span className="row" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">Topic · {topic.question}</span>
        <span className="pill think">Your turn</span>
      </span>
      <span className="q">{note.asks ?? firstSentence(note.text)}</span>
      {!answering && <span className="sub px-clamp">{note.text.replace(/[#*]/g, "")}</span>}
      {answering && <Md text={note.text} />}
      <Meta note={note} now={now} />
      {answering && <AnswerBox note={note} act={act} />}
      <div className="row">
        {!answering && (
          <button type="button" className="btn pri" onClick={() => setAnswering(true)}>
            Read and answer
          </button>
        )}
        <KeepDismiss note={note} act={act} />
        <button type="button" className="btn quiet" onClick={goPage}>
          Open the topic
        </button>
      </div>
    </div>
  );
}

function PageB({ topic, act, now }: P) {
  const open = waiting(topic);
  const [panel, setPanel] = useState<"ask" | "think" | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const kept = record(topic).filter((e) => !("note" in e) || e.note.status === "kept").reverse();
  const dismissed = topic.notes.filter((n) => n.status === "dismissed").length;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <Title
        topic={topic}
        right={
          <HeaderActions topic={topic} act={act}>
            <button type="button" className={`btn${panel === "ask" ? " pri" : ""}`} onClick={() => setPanel(panel === "ask" ? null : "ask")}>
              Ask now
            </button>
            <button type="button" className={`btn${panel === "think" ? " pri" : ""}`} onClick={() => setPanel(panel === "think" ? null : "think")}>
              Think about it
            </button>
          </HeaderActions>
        }
      />
      {panel && <div className="px-pop">{panel === "ask" ? <AskNow topic={topic} act={act} /> : <ThinkMenu act={act} onDone={() => setPanel(null)} />}</div>}
      <div className="px-grid">
        <div className="px-doc stack" style={{ gap: 14 }}>
          <Stand topic={topic} now={now} />
          <div>
            {kept.map((e) =>
              "note" in e ? (
                e.note.kind === "stand" ? null : (
                  <div key={e.note.id} className="entry">
                    <Md text={e.note.text} />
                    <Meta note={e.note} now={now} />
                  </div>
                )
              ) : (
                <div key={e.response.id} className="entry you">
                  <p>{e.response.text}</p>
                  <span className="px-meta">You · {ago(e.at, now)}</span>
                </div>
              ),
            )}
          </div>
          {dismissed > 0 && <span className="px-meta">{dismissed} dismissed, not shown</span>}
          <Material topic={topic} />
        </div>
        <div className="stack" style={{ gap: 10, position: "sticky", top: 12 }}>
          <span className="eyebrow">{open.length ? `Waiting for you · ${open.length}` : "Nothing waits for you"}</span>
          {open.map((n) => (
            <div key={n.id} className="px-open">
              {answering === n.id ? <Md text={n.text} /> : <span className="px-clamp">{n.asks ?? firstSentence(n.text)}</span>}
              <Meta note={n} now={now} />
              {answering === n.id && <AnswerBox note={n} act={act} rows={2} />}
              <div className="row">
                {answering !== n.id && (
                  <button type="button" className="btn pri" onClick={() => setAnswering(n.id)}>
                    {n.kind === "note" ? "Read and answer" : "Read"}
                  </button>
                )}
                <KeepDismiss note={n} act={act} />
              </div>
            </div>
          ))}
          <Runs topic={topic} act={act} />
        </div>
      </div>
    </div>
  );
}

// --- Variant C: one waiting note at a time with the answer beside it, the record as quiet lines below ---

function Beside({ topic, act, now, note, count }: { topic: Topic; act: Acts; now: number; note: Note; count?: ReactNode }) {
  const [side, setSide] = useState<"answer" | "ask">("answer");
  return (
    <div className="px-two">
      <div className="stack">
        {note.asks && <span className="px-asks">{note.asks}</span>}
        <Md text={note.asks ? note.text.replace(`**${note.asks}**`, "").trimEnd() : note.text} />
        <Meta note={note} now={now} />
      </div>
      <div className="stack">
        {count}
        {side === "answer" ? <AnswerBox note={note} act={act} rows={5} /> : <AskNow topic={topic} act={act} about={firstSentence(note.asks ?? note.text)} />}
        <div className="row">
          <KeepDismiss note={note} act={act} />
          <button type="button" className="btn quiet" onClick={() => setSide(side === "answer" ? "ask" : "answer")}>
            {side === "answer" ? "Ask now about this instead" : "Back to answering"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DayC({ topic, act, now, goPage }: P) {
  const note = waiting(topic)[0];
  if (!note) return <DayDone goPage={goPage} />;
  return (
    <div className="card" style={{ maxWidth: "none" }}>
      <span className="row" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">Topic · {topic.question}</span>
        <button type="button" className="btn quiet" onClick={goPage}>
          Open the topic
        </button>
      </span>
      <Beside topic={topic} act={act} now={now} note={note} />
    </div>
  );
}

function PageC({ topic, act, now }: P) {
  const open = waiting(topic);
  const [at, setAt] = useState(0);
  const [think, setThink] = useState(false);
  const note = open[Math.min(at, open.length - 1)];
  return (
    <div className="stack" style={{ gap: 18 }}>
      <Title topic={topic} right={<HeaderActions topic={topic} act={act} />} />
      <Stand topic={topic} now={now} />
      {note ? (
        <div className="px-open" style={{ padding: 18 }}>
          <Beside
            topic={topic}
            act={act}
            now={now}
            note={note}
            count={
              <span className="row" style={{ justifyContent: "space-between" }}>
                <span className="eyebrow">Waiting for you · {Math.min(at, open.length - 1) + 1} of {open.length}</span>
                {open.length > 1 && (
                  <button type="button" className="btn quiet" onClick={() => setAt((at + 1) % open.length)}>
                    Next
                  </button>
                )}
              </span>
            }
          />
        </div>
      ) : (
        <span className="faint">Nothing waits for you on this topic.</span>
      )}
      <div className="stack">
        <span className="px-meta">
          Not ready to answer?{" "}
          <button type="button" onClick={() => setThink(!think)}>
            Have the assistant think about it
          </button>
        </span>
        {think && <div className="px-pop"><ThinkMenu act={act} onDone={() => setThink(false)} /></div>}
        <Runs topic={topic} act={act} />
      </div>
      <div className="stack" style={{ gap: 0 }}>
        <span className="eyebrow">The record</span>
        <Record topic={topic} now={now} collapse={firstSentence} />
      </div>
      <Material topic={topic} />
    </div>
  );
}

function DayDone({ goPage }: { goPage: () => void }) {
  return (
    <div className="card dashed">
      <span className="sub">Answered. The Day moves to the next card.</span>
      <div className="row">
        <button type="button" className="btn quiet" onClick={goPage}>
          Open the topic
        </button>
      </div>
    </div>
  );
}

const desk = (mode: DeskMode) => (p: P) => <Desk {...p} mode={mode} />;
const DeskOut = desk("out");
const DeskFloat = desk("float");
const DAY = { A: DayA, B: DayB, C: DayC, D: One, E: Talk, F: Sentence, G: Desk, H: DeskOut, I: DeskFloat };
const PAGE = { A: PageA, B: PageB, C: PageC, D: One, E: Talk, F: Sentence, G: Desk, H: DeskOut, I: DeskFloat };
const SIMPLE = ["D", "E", "F", "G", "H", "I"];
const WIDE = ["G", "H", "I"];

export function StudioPrototype() {
  const now = useMemo(() => Date.now(), []);
  const [topic, setTopic] = useState(() => fixture(now));
  const act = useMemo(() => acts(setTopic), []);
  const params = new URLSearchParams(location.search);
  const [variant, setVariantState] = useState<Key>(VARIANTS.some(([k]) => k === params.get("variant")) ? (params.get("variant") as Key) : "G");
  const [screen, setScreenState] = useState<Screen>(params.get("screen") === "page" ? "page" : "day");
  const go = (v: Key, s: Screen) => {
    setVariantState(v);
    setScreenState(s);
    const next = new URLSearchParams(location.search);
    next.set("variant", v);
    next.set("screen", s);
    history.replaceState(null, "", `?${next}`);
  };
  const cycle = (step: number) => {
    const i = VARIANTS.findIndex(([k]) => k === variant);
    go(VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length]![0], screen);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const Day = DAY[variant];
  const Page = PAGE[variant];
  const props: P = { topic, act, now, goPage: () => go(variant, "page") };
  return (
    <main className="wrap px" style={WIDE.includes(variant) ? { maxWidth: "none", paddingInline: 28 } : undefined}>
      <style>{CSS + SIMPLE_CSS + DESK_CSS}</style>
      <Header />
      <div className="px-state">
        prototype · waiting {waiting(topic).length} · notes {topic.notes.length} · answers {topic.responses.length} · runs {topic.runs.map((r) => `${r.mode}:${r.status}`).join(", ") || "none"} · topic {topic.state} · last: {topic.last}{" "}
        <button type="button" className="btn quiet" onClick={() => setTopic(fixture(now))}>
          reset
        </button>
      </div>
      {SIMPLE.includes(variant) ? (
        <Day key={variant} {...props} />
      ) : screen === "day" ? (
        <div className="px-daycol" style={variant === "C" ? { maxWidth: 980 } : undefined}>
          <span className="faint">A question in the Studio waits for your answer.</span>
          <Day key={variant} {...props} />
        </div>
      ) : (
        <Page key={variant} {...props} />
      )}
      <div className="px-switch">
        <button type="button" onClick={() => cycle(-1)}>←</button>
        <span>
          {variant} ({VARIANTS.find(([k]) => k === variant)![1]})
        </span>
        <button type="button" onClick={() => cycle(1)}>→</button>
        {!SIMPLE.includes(variant) && <><button type="button" className={screen === "day" ? "on" : ""} onClick={() => go(variant, "day")}>Day card</button>
        <button type="button" className={screen === "page" ? "on" : ""} onClick={() => go(variant, "page")}>Topic page</button></>}
      </div>
    </main>
  );
}

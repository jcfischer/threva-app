// PROTOTYPE, round 2: three radically simpler takes. In each, the Day card and the topic are the same thing:
// there is no second screen. Built for a weak working memory: one thing visible, one act, a clear end.
// D "One question"   the assistant asks, you answer, next. Nothing else on screen.
// E "Just talk"      the topic is a conversation with one box.
// F "The sentence"   the topic is your stand. Everything the assistant does is a rewrite of it.
import { useState, type ReactNode } from "react";
import { firstSentence, record, waiting, type Note, type Topic } from "./data";
import { Md, Record, type Acts } from "./prototype";

export const SIMPLE_CSS = `
.sx{max-width:640px;margin:24px auto 0;width:100%;display:flex;flex-direction:column;gap:18px}
.sx-quiet,.sx-chip,.sx-foot span{white-space:nowrap}
.sx-topic{font-size:13.5px;color:var(--faint)}
.sx-ask{font-size:24px;line-height:1.3;font-weight:650;margin:0}
.sx-quote{border-left:3px solid var(--accent);padding:2px 0 2px 14px;font-size:17px;margin:0}
.sx-big{font-size:17px;padding:12px 14px;border-radius:12px;min-height:96px;width:100%}
.sx-chips{display:flex;flex-wrap:wrap;gap:8px}
.sx-chip{border:1px solid var(--line);background:var(--panel);border-radius:99px;padding:8px 16px;font:inherit;font-size:15px;cursor:pointer;color:inherit}
.sx-chip:hover{border-color:var(--accent);color:var(--accent)}
.sx-yes{font-size:17px;padding:12px 26px;border-radius:12px}
.sx-quiet{background:none;border:0;padding:0;font:inherit;font-size:13.5px;color:var(--faint);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.sx-foot{display:flex;justify-content:space-between;align-items:center;font-size:13.5px;color:var(--faint)}
.sx-done{font-size:22px;font-weight:650;margin:0}
.sx-why{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--panel)}
.sx-chat{display:flex;flex-direction:column;gap:10px}
.sx-b{max-width:88%;border-radius:14px;padding:9px 14px;font-size:16px}
.sx-b.them{align-self:flex-start;background:var(--panel);border:1px solid var(--line)}
.sx-b.me{align-self:flex-end;background:var(--accent-soft)}
.sx-pin{font-size:15px;color:var(--dim);border-left:3px solid var(--accent);padding-left:12px}
.sx-bar{display:flex;gap:8px;align-items:flex-end;position:sticky;bottom:64px;background:var(--bg);padding:8px 0}
.sx-bar textarea{flex:1;min-height:48px;font-size:16px;border-radius:12px;padding:11px 13px}
.sx-sentence{font-size:25px;line-height:1.35;font-weight:650;border:0;background:none;color:inherit;width:100%;resize:none;padding:0;font-family:inherit;min-height:0}
.sx-sentence:focus{outline:2px solid var(--accent-soft);outline-offset:8px;border-radius:4px}
.sx-sug{border:1px dashed var(--accent);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
`;

/** Each waiting note as one plain question. Cortex gap: today it sends neither the question nor a one-line gist. */
const ASK: { [id: string]: { ask: string; quote?: string; replies?: string[] } } = {
  n9: { ask: "Which card should a newcomer see first?", replies: ["The assistant's own card", "Whatever ranks highest", "I don't know yet"] },
  n8: { ask: "Is this where you stand now?", quote: "The first day is staged: three cards chosen to teach, then the real queue." },
  n7: { ask: "Keep this idea?", quote: "Drop the word \"Desk\" from the first screen." },
};

function asked(note: Note) {
  const known = ASK[note.id];
  if (known) return known;
  if (note.kind === "stand") return { ask: "Is this where you stand now?", quote: note.text };
  if (note.kind === "idea") return { ask: "Keep this idea?", quote: firstSentence(note.text) };
  return { ask: "What do you say to this?", quote: firstSentence(note.text) };
}

interface P {
  topic: Topic;
  act: Acts;
  now: number;
}

function More({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span>
        <button type="button" className="sx-quiet" onClick={() => setOpen(!open)}>
          {open ? "Hide" : label}
        </button>
      </span>
      {open && children}
    </>
  );
}

function Everything({ topic, act, now }: P) {
  return (
    <More label="Everything on this topic">
      <div className="sx-why stack">
        <Record topic={topic} now={now} collapse={firstSentence} />
        <span className="row">
          <button type="button" className="btn quiet" onClick={() => act.state(topic.state === "parked" ? "active" : "parked")}>
            {topic.state === "parked" ? "Take it up again" : "Park this topic"}
          </button>
          <button type="button" className="btn quiet" onClick={() => act.state("closed")}>
            Finish this topic
          </button>
        </span>
      </div>
    </More>
  );
}

// --- D: one question ---

export function One({ topic, act, now }: P) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [thanks, setThanks] = useState(false);
  const open = waiting(topic).filter((n) => !skipped.includes(n.id));
  const note = open[0];
  const done = (fn: () => void) => { fn(); setText(""); setThanks(true); };
  if (!note)
    return (
      <div className="sx">
        <span className="sx-topic">{topic.question}</span>
        <p className="sx-done">That's all for now.</p>
        <p className="sx-quote">{topic.stand}</p>
        <span className="faint">The assistant thinks about what you said and comes back with the next question.</span>
        <Everything topic={topic} act={act} now={now} />
      </div>
    );
  const q = asked(note);
  const yesNo = note.kind !== "note";
  return (
    <div className="sx">
      <span className="sx-topic">{topic.question}</span>
      <h2 className="sx-ask">{q.ask}</h2>
      {q.quote && <p className="sx-quote">{q.quote}</p>}
      {yesNo ? (
        <div className="row">
          <button type="button" className="btn pri sx-yes" onClick={() => done(() => act.keep(note.id))}>
            Yes
          </button>
          <button type="button" className="btn sx-yes" onClick={() => done(() => act.dismiss(note.id))}>
            No
          </button>
        </div>
      ) : (
        <>
          <textarea
            className="sx-big"
            autoFocus
            placeholder="One sentence is enough. Enter sends."
            value={text}
            onChange={(e) => { setText(e.target.value); setThanks(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && text.trim()) { e.preventDefault(); done(() => act.answer(note.id, text.trim())); }
            }}
          />
          <div className="sx-chips">
            {(q.replies ?? []).map((r) => (
              <button key={r} type="button" className="sx-chip" onClick={() => done(() => act.answer(note.id, r))}>
                {r}
              </button>
            ))}
          </div>
        </>
      )}
      <More label="Why are you asking?">
        <div className="sx-why">
          <Md text={note.text} />
        </div>
      </More>
      <div className="sx-foot">
        <button type="button" className="sx-quiet" onClick={() => setSkipped([...skipped, note.id])}>
          Not now
        </button>
        <span>{thanks ? "Got it. " : ""}{open.length > 1 ? `${open.length - 1} more after this` : "Last one"}</span>
      </div>
      <Everything topic={topic} act={act} now={now} />
    </div>
  );
}

// --- E: just talk ---

export function Talk({ topic, act, now }: P) {
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);
  const open = waiting(topic).slice().reverse();
  const earlier = record(topic).filter((e) => !("note" in e) || e.note.status === "kept").reverse();
  const shown = all ? earlier : earlier.slice(-1);
  const pending = topic.runs.find((r) => r.status === "pending");
  const send = () => {
    const words = text.trim();
    if (!words) return;
    const target = open.find((n) => n.kind === "note");
    if (target) act.answer(target.id, words);
    else act.ask(words);
    setText("");
  };
  return (
    <div className="sx">
      <span className="sx-topic">{topic.question}</span>
      <div className="sx-pin">{topic.stand}</div>
      <div className="sx-chat">
        {!all && earlier.length > 1 && (
          <span>
            <button type="button" className="sx-quiet" onClick={() => setAll(true)}>
              {earlier.length - 1} earlier
            </button>
          </span>
        )}
        {shown.map((e) =>
          "note" in e ? (
            <div key={e.note.id} className="sx-b them">
              {firstSentence(e.note.text)}
            </div>
          ) : (
            <div key={e.response.id} className="sx-b me">
              {e.response.text}
            </div>
          ),
        )}
        {open.map((n) => {
          const q = asked(n);
          return (
            <div key={n.id} className="sx-b them stack">
              <span>
                {q.quote ? `${q.quote} ` : ""}
                <b>{q.ask}</b>
              </span>
              {n.kind !== "note" && (
                <span className="row">
                  <button type="button" className="sx-chip" onClick={() => act.keep(n.id)}>Yes</button>
                  <button type="button" className="sx-chip" onClick={() => act.dismiss(n.id)}>No</button>
                </span>
              )}
              <More label="More">
                <Md text={n.text} />
              </More>
            </div>
          );
        })}
        {topic.chat.map((line, i) => (
          <div key={i} className={`sx-b ${line.who === "you" ? "me" : "them"}`}>
            {line.text}
          </div>
        ))}
        {pending && (
          <div className="sx-b them faint">
            Thinking…{" "}
            <button type="button" className="sx-quiet" onClick={() => act.land(pending.id)}>
              (prototype: let it land)
            </button>
          </div>
        )}
      </div>
      <div className="sx-bar">
        <textarea
          autoFocus
          rows={1}
          placeholder="Say something"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <button type="button" className="btn" onClick={() => act.think("grill", "now")}>
          Challenge me
        </button>
      </div>
      <Everything topic={topic} act={act} now={now} />
    </div>
  );
}

// --- F: the sentence ---

export function Sentence({ topic, act, now }: P) {
  const [draft, setDraft] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const note = waiting(topic).sort((a, b) => Number(b.kind === "stand") - Number(a.kind === "stand"))[0];
  const q = note ? asked(note) : null;
  const save = () => {
    if (draft !== null && draft.trim() && draft.trim() !== topic.stand) act.setStand(draft.trim());
    setDraft(null);
  };
  return (
    <div className="sx">
      <span className="sx-topic">{topic.question}</span>
      <textarea
        className="sx-sentence"
        rows={4}
        aria-label="Where I stand"
        value={draft ?? topic.stand}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        }}
      />
      <span className="sx-foot">
        <span>Version {topic.standHistory.length + 1}. Click the sentence to rewrite it.</span>
        <span />
      </span>
      {note && q && (
        <div className="sx-sug">
          {note.kind === "stand" ? (
            <>
              <span className="eyebrow">The assistant would say it like this</span>
              <p className="sx-quote" style={{ fontWeight: 600 }}>{note.text}</p>
              <div className="row">
                <button type="button" className="btn pri" onClick={() => act.keep(note.id)}>Take it</button>
                <button type="button" className="btn" onClick={() => act.dismiss(note.id)}>Keep mine</button>
              </div>
            </>
          ) : note.kind === "idea" ? (
            <>
              <span className="eyebrow">An idea</span>
              <p className="sx-quote">{q.quote}</p>
              <div className="row">
                <button type="button" className="btn pri" onClick={() => { act.keep(note.id); act.propose(); }}>Work it in</button>
                <button type="button" className="btn" onClick={() => act.dismiss(note.id)}>Drop it</button>
              </div>
            </>
          ) : (
            <>
              <span className="eyebrow">One question, then the assistant rewrites the sentence</span>
              <b style={{ fontSize: 17 }}>{q.ask}</b>
              <input
                type="text"
                placeholder="Your answer. Enter sends."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && answer.trim()) { act.answer(note.id, answer.trim()); act.propose(); setAnswer(""); }
                }}
              />
            </>
          )}
          <More label="Why?">
            <Md text={note.text} />
          </More>
        </div>
      )}
      {!note && <span className="faint">Nothing to decide. The sentence stands.</span>}
      <div className="row">
        <button type="button" className="btn" onClick={() => act.state("closed")}>
          This is it. Finish the topic.
        </button>
      </div>
      <More label="How the sentence changed">
        <ol className="px-hist" reversed>
          {topic.standHistory.map((v, i) => (
            <li key={i}>{v.text}</li>
          ))}
        </ol>
      </More>
      <Everything topic={topic} act={act} now={now} />
    </div>
  );
}

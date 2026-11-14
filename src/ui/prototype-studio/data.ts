// PROTOTYPE data for the Studio redesign (docs/design/studio-redesign.md). Throwaway. Everything lives in memory.

export type Mode = "think" | "grill" | "other-side" | "red-team" | "first-principles" | "persona:Mara";

export const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: "think", label: "Think it over", hint: "Read everything again and tell me what you see." },
  { mode: "grill", label: "Ask me hard questions", hint: "Find what I haven't thought through." },
  { mode: "other-side", label: "Argue the other side", hint: "Make the best case against where I stand." },
  { mode: "red-team", label: "Find holes in it", hint: "Attack the plan like someone who wants it to fail." },
  { mode: "first-principles", label: "Start from scratch", hint: "Forget what's there. What would you build?" },
  { mode: "persona:Mara", label: "What would Mara say?", hint: "Answer in the voice of Mara, who has never seen the Desk." },
];

export const modeLabel = (mode: Mode) => MODES.find((m) => m.mode === mode)?.label ?? mode;

export interface Note {
  id: string;
  at: number;
  kind: "note" | "stand" | "idea";
  status: "open" | "kept" | "dismissed";
  mode: Mode;
  trigger: string;
  model: string;
  text: string;
  /** Q3 gap: the question Cortex would say this note asks. Absent when the note asks nothing. */
  asks?: string;
}

export interface Response {
  id: string;
  at: number;
  re?: string;
  text: string;
}

export interface Run {
  id: string;
  mode: Mode;
  when: "now" | "tonight";
  status: "pending" | "failed";
  reason?: string;
}

export interface Topic {
  question: string;
  stand: string;
  standHistory: { at: number; text: string }[];
  notes: Note[];
  responses: Response[];
  material: { label: string; kind: string; why: string }[];
  runs: Run[];
  chat: { who: "you" | "assistant"; text: string }[];
  state: "active" | "parked" | "closed";
  last: string;
}

const H = 3_600_000;
const D = 24 * H;

export function fixture(now: number): Topic {
  const note = (id: string, ago: number, kind: Note["kind"], status: Note["status"], mode: Mode, trigger: string, text: string, asks?: string): Note => ({
    id,
    at: now - ago,
    kind,
    status,
    mode,
    trigger,
    model: "Qwen 3.8 27B (local)",
    text,
    ...(asks ? { asks } : {}),
  });
  return {
    question: "How do I make the Desk understandable to a person who hasn't used it before?",
    stand: "Start from one card at a time and explain nothing up front. The first screen must teach itself: one card, one decision, one sentence that says why it is here.",
    standHistory: [
      { at: now - 9 * D, text: "A newcomer needs a guided tour before they see their own day." },
      { at: now - 12 * D, text: "The Desk needs better documentation." },
    ],
    notes: [
      note(
        "n9",
        2 * H,
        "note",
        "open",
        "grill",
        "You asked",
        "## The first card decides everything\n\nYou say the first screen must teach itself. Then the first card a newcomer sees carries the whole product.\n\n- A mail card teaches \"this is an inbox\". That is the wrong lesson.\n- A meeting card teaches \"this is a calendar\".\n- A card the assistant wrote itself teaches \"something here thinks for me\".\n\nSo the order of the first three cards is a design decision, not a ranking result.\n\n**Which card should a newcomer see first, and are you willing to break the normal ranking for it?**",
        "Which card should a newcomer see first, and are you willing to break the normal ranking for it?",
      ),
      note(
        "n8",
        20 * H,
        "stand",
        "open",
        "think",
        "Overnight",
        "Start from one card at a time and explain nothing up front. The first day is staged: three cards chosen to teach, then the real queue.",
      ),
      note(
        "n7",
        22 * H,
        "idea",
        "open",
        "first-principles",
        "Overnight",
        "Drop the word \"Desk\" from the first screen. A newcomer does not need the name of the thing to use it. Show the card and the sentence \"Here is the one thing that needs you now.\"",
      ),
      note(
        "n6",
        2 * D + 3 * H,
        "note",
        "kept",
        "red-team",
        "You asked",
        "## Where this fails\n\nOne card at a time fails the person who arrives with forty things waiting. They see one card and no sense of how much is behind it, so they do not trust it.\n\nThe count in the bar helps only if they notice the bar. In three of the four screenshots you saved, the eye goes to the card and stays there.\n\nA cheap fix: the first card says how many more there are, once.",
      ),
      note(
        "n5",
        2 * D + 5 * H,
        "idea",
        "dismissed",
        "think",
        "New material",
        "Add a short video that plays on first start.",
      ),
      note(
        "n4",
        5 * D,
        "note",
        "kept",
        "other-side",
        "You asked",
        "The other side: people do not read a product, they ask a colleague. The Desk is understood when one person can explain it to the next in a sentence. Work on that sentence, and the screen follows. Today nobody can say it in under thirty seconds.",
      ),
      note("n3", 9 * D, "stand", "kept", "think", "Overnight", "A newcomer needs a guided tour before they see their own day."),
      note(
        "n2",
        9 * D + 2 * H,
        "note",
        "kept",
        "think",
        "New material",
        "## Three observations from the capture\n\n1. The person in the capture read the header, then scrolled, looking for a list.\n2. They clicked \"Everything\" within ten seconds.\n3. They came back to the Day only after being told to.\n\nThe list is what people expect. The card is what you want them to use.",
      ),
      note("n1", 12 * D, "stand", "kept", "think", "Topic opened", "The Desk needs better documentation."),
    ],
    responses: [
      {
        id: "r1",
        at: now - 5 * D + 2 * H,
        re: "n4",
        text: "Agreed on the sentence. My try: \"It shows you the one thing that needs you now, and keeps the rest.\"",
      },
    ],
    material: [{ label: "Screen recording: first five minutes with the Desk", kind: "capture", why: "You filed it here on 5 November." }],
    runs: [{ id: "run1", mode: "red-team", when: "now", status: "failed", reason: "The local model ran out of memory while reading the material." }],
    chat: [],
    state: "active",
    last: "nothing yet",
  };
}

/** Open notes nobody has answered, newest first. */
export const waiting = (t: Topic) => t.notes.filter((n) => n.status === "open" && !t.responses.some((r) => r.re === n.id)).sort((a, b) => b.at - a.at);

export const record = (t: Topic) => {
  const open = new Set(waiting(t).map((n) => n.id));
  return [
    ...t.notes.filter((n) => !open.has(n.id)).map((note) => ({ at: note.at, note })),
    ...t.responses.map((response) => ({ at: response.at, response })),
  ].sort((a, b) => b.at - a.at);
};

export function ago(at: number, now: number): string {
  const d = now - at;
  if (d < H) return "just now";
  if (d < 20 * H) return `${Math.round(d / H)} hours ago`;
  if (d < 2 * D) return "yesterday";
  if (d < 7 * D) return `${Math.floor(d / D)} days ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function dayOf(at: number, now: number): string {
  const d = Math.floor((now - at) / D);
  if (d < 1) return "Today";
  if (d < 2) return "Yesterday";
  return new Date(at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

const plain = (line: string) => line.replace(/^#+\s*|^[-*]\s+|^\d+\.\s+/, "").replace(/\*\*/g, "");

/** Collapse rule 1: the first line as written, which may be a heading. */
export const firstLine = (text: string) => plain(text.split("\n").find((l) => l.trim()) ?? "");

/** Collapse rule 2: the first sentence of the body, skipping headings. */
export function firstSentence(text: string): string {
  const body = text.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? text;
  const line = plain(body);
  const end = line.search(/[.?!](\s|$)/);
  return end < 0 ? line : line.slice(0, end + 1);
}

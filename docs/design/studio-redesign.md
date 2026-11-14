# Studio redesign: brief for a UI/UX session

Status: open. Owner: Jens-Christian. Written 2026-11-14 from the live stack, for a working session with a design agent.

This document is the starting point, not the answer. Work through the questions in "Decisions to make" together, record each answer here, and end with a plan of build nodes on the Threva map (`Refs #1`).

## How to use this document

1. Read "What Studio is" and "What the screen does today" so you share the same picture.
2. Look at the live screen: Threva on the principal's stack, Day view, a Studio card, then "Open". The dev stack (`bun run dev:stack`, port 8790) has two sample topics if you need a safe copy to click around in.
3. Go through the findings (F codes). Add or strike findings; don't solve them yet.
4. Decide the questions (Q codes). Each has options and a starting pick to argue with.
5. Prototype the chosen direction before building it. Use the prototype skill and a throwaway branch, as the Everything view was done on `prototype/everything-time-lens`.
6. End with build nodes: one vertical slice each, and a list of Cortex gaps filed on the Cortex map (`the-metafactory/cortex#3555`).

## Terms

The principal ruled on 2026-11-14 that a Studio "thread" is called a **topic** in Threva's own text (German **Thema**). Cortex, its API and the Studio files keep "thread". This document uses "topic" for the user-facing thing and `thread` for the API object.

## What Studio is

Studio is where the principal keeps a small number of open questions or projects alive between sessions, and where the assistant thinks about them overnight or on request. It lives in a git repository of Markdown files that Cortex owns. Threva reads and writes it only through `/api/desk/studio`.

What the API gives Threva (live shape, Cortex v6.29.0):

- **Topics** in three lists: `active` (at most `maxActive`, 5 today), `parked` and `closed`. On the live stack today: 4 active, 1 parked, 11 closed.
- **Each topic** (`thread`) has:
  - `question`: the topic's title, usually phrased as a question.
  - `stand`: "where I stand", the principal's current position in one or two sentences.
  - `notes`: what the assistant wrote. Each has a `kind` (note, stand proposal, idea, relation), a `status` (open, kept, dismissed), the trigger that caused it (for example "New Material committed"), the model and the sparring mode.
  - `responses`: what the principal wrote back to a note.
  - `material`: linked captures, mails and other sources.
  - `log`: the topic's history, such as opened, filtered or parked.
  - `areas` and `policy`: which area the topic belongs to and whether a local or a cloud model may read it.
  - `thinkTonight` and `thinking`: whether the assistant should think about it tonight, and its recent runs, including failures.
  - `place`: its rank among active topics.
- **Studio-wide**:
  - `inbox`: captures not yet filed, each with a proposed target topic.
  - `proposals`: new topics the assistant suggests, each with a reason.
  - `yesFilter`: the questions to ask before saying yes to a new topic.
  - `personas`: extra sparring voices.
  - `problems`, and `thinking` (daily run budget).

Ways to talk to the assistant about a topic today (all of them on one screen):

1. **Respond** to the topic: a text box under the timeline. It lands as a `response`.
2. **Sparring**: five mode buttons (Think now, Grill me, Argue the other side, Red team, First principles) plus one "What would {name} say?" per persona. Each starts a run whose answer lands later as a note.
3. **Talk it through**: a live conversation (`/api/conversations`) linked to the topic.
4. **Discuss** a single note: a conversation scoped to that note.
5. **Think it over tonight**: a toggle that queues an overnight run.
6. In the Everything view: a topic opens as the page of its row, with open notes in the margin and "ask the assistant" on the page (Threva nodes 63 and 64).

## What the screen does today

Code: `src/ui/studio/card.tsx` (closed card and open view), `sparring.tsx`, `conversation.tsx`, `act.ts`. Closed, it is a card in the Day queue with the question, the stand and "Open". Open, it takes over the card area:

- Header: "Studio", a "Your turn" pill, "Back to the cards".
- The question as a large heading.
- Left column:
  - "Where I stand" with the stand.
  - All notes and responses in time order, oldest first. Each note has a metadata line (kind · assistant · date · trigger) and a status pill, plus keep/dismiss buttons while it's open.
  - The respond box and "Send".
  - "Talk it through".
  - "Think it over tonight", "Close with an outcome", and "Park".
- Right column: the sparring buttons, then the material list.

## Findings

From the principal's screenshot of the live stack (topic "Make the Desk understandable to a person that hasn't used it before…", 9 notes, 1 response, 1 material item) and the code.

- **F1, no clear next step:** the card says "Your turn", and the Day view says a question waits for an answer. Nothing on the open screen says *which* question, or what answering looks like.
- **F2, five ways to talk:** the five ways of talking to the assistant compete on one screen, with no explanation of how they differ or where each answer will appear. Respond, sparring, talk it through, discuss and think tonight all feed the same topic differently.
- **F3, sparring modes unexplained:** the mode buttons have no explanation. "Grill me", "Argue the other side", "Red team" and "First principles" mean nothing to a newcomer. The only hint is "Each answer lands here as a note.".
- **F4, the stand shown twice:** the stand appears at the top ("Where I stand") and again as a kept "Proposal for your stand" note with identical text.
- **F5, noisy metadata:** each note's metadata line is long, all caps and mixed-language, for example "NOTE · THE ASSISTANT · MONDAY, 2 NOVEMBER, 21:25 · NEW MATERIAL COMMITTED". The trigger is raw Cortex text, in English inside a German screen. It outweighs the note.
- **F6, notes are walls of text:** assistant answers are unformatted. Markdown is being fixed separately, in Threva node 79. There is no summary line, so you can't skim nine notes.
- **F7, oldest first:** the timeline puts the oldest entry first, so what's new is at the bottom of a long scroll, below text already read.
- **F8, raw failures:** a failed run shows as "Thinking failed · exit -1", with no cause and no way to retry or see what failed.
- **F9, thin material:** the material rail shows one truncated capture and nothing about why it's linked. There's no way to add material from here.
- **F10, the open view takes over the Day:** "Back to the cards" is the only way out. The topic isn't reachable from the Everything view as one consistent place, because both a Studio card and a row page now exist for the same topic.
- **F11, Studio-wide items missing:** the inbox (captures waiting to be filed) and proposals (new topics the assistant suggests) are in the API but appear nowhere in Threva.
- **F12, closing is a form at the bottom:** closing, parking and "think it over tonight" sit at the bottom of the left column, and closing asks for an outcome (decided, shipped, dropped) in a form there.
- **F13, the model as a file path:** a conversation shows the model as a full file path, for example "mlx-local//Users/…/qwen3.8-27b-4bit". Cortex sends only the raw model id. A display name is a Cortex gap.

## Decisions to make

Each question lists the options weighed and a starting pick. The pick is a position to argue with, not a decision.

- **Q1, where a topic lives:**
  - O1: keep a separate Studio screen.
  - O2: a topic is the page of its row in Everything, and the Day card links there.
  - O3: Studio becomes its own view next to Day and Everything.
  - *Start with O2.* It is one place per topic, it builds on nodes 63 and 64, and it removes F10. The cost is that the Everything page must carry notes, stand and actions without becoming cluttered.
- **Q2, how many ways to talk:**
  - O1: keep all five.
  - O2: one conversation per topic, with modes as a choice inside it ("answer as: think / grill / other side…"), and overnight thinking as a setting of the topic.
  - O3: two only: "Ask now" (conversation) and "Think about it" (background run, mode chosen in a menu).
  - *Start with O3.* It separates "I wait for an answer" from "I'll look later", which is the real difference for the user.
- **Q3, what "Your turn" means:**
  - O1: open notes count as waiting.
  - O2: only a note that asks the principal something counts. The question is shown on top, with the answer box beside it.
  - O3: Cortex sends an explicit `waitsFor` with the question text.
  - *Start with O2.* O3 if Cortex can't tell which note asks something; that is a Cortex gap to file.
- **Q4, order and density of notes:**
  - O1: newest first.
  - O2: open notes first, then the rest grouped by day and collapsed to their first line.
  - O3: a summary at the top that the assistant maintains, with notes behind it.
  - *Start with O2.* O3 needs Cortex to keep a summary.
- **Q5, the stand:**
  - O1: an editable block at the top.
  - O2: the stand plus its history: kept proposals become versions, not separate notes.
  - *Start with O2.* It removes F4.
- **Q6, sparring modes:**
  - O1: buttons with a one-line description each.
  - O2: a menu with descriptions and an example question.
  - O3: drop the names and ask "What do you want from the assistant?" with plain options such as "Find holes in it", "Argue the other side" and "Start from scratch".
  - *Start with O3*, using plain words, in the voice of the prototype.
- **Q7, metadata on a note:**
  - O1: show only relative time and the mode. Model, trigger and run go behind a details toggle.
  - O2: as today.
  - *Start with O1.* It needs catalog strings for each trigger, or a display text from Cortex (gap).
- **Q8, failures:**
  - O1: the failed run shows its cause, in plain words, and "Try again".
  - O2: hide it.
  - *Start with O1.* Needs Cortex to send a reason a person can read, not `exit -1` (gap).
- **Q9, Studio-wide inbox and proposals:**
  - O1: as Day cards ("File this capture under topic X?", "Start a new topic: …?").
  - O2: a Studio section in Everything.
  - *Start with O1.* Each is a one-card decision, which fits the product.
- **Q10, finishing and parking:**
  - O1: actions in the topic header.
  - O2: as today, at the bottom.
  - *Start with O1*, and closing still asks for the outcome in one step.

## Constraints

From `AGENTS.md` and the map; these hold for every option.

- Threva talks to Cortex only over HTTP and WebSocket. Anything the API doesn't return becomes a Cortex gap, filed on `the-metafactory/cortex#3555`, not logic in Threva.
- Every string comes from the typed catalog in English and German. Text that Cortex or the assistant writes is shown as sent, and Markdown-formatted once node 79 lands.
- One card at a time on the Day view stays the core of the product. A topic screen must not become a dashboard.
- The prototype in `prototype/` is the voice and layout reference. It is never edited.

## Known Cortex gaps this redesign will likely need

These are not filed yet. File each one once the matching decision is made.

- A display name for the model of a note or turn (F13).
- A readable reason for a failed thinking run (F8, Q8).
- Which note, if any, asks the principal something, and its question text (Q3).
- Display text for note triggers, or a stable trigger id the catalog can translate (Q7).
- Optional: a maintained topic summary (Q4, O3).

## Outcome

Fill in as decisions are made.

| Code | Decision | Date |
|---|---|---|
| | | |

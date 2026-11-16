# Studio redesign: brief for a UI/UX session

Status: decided (variant H, the work desk) and filed. Decision jcfischer/threva-app#89; open work is on the Threva and Cortex maps. Owner: Jens-Christian. Written 2026-11-14 from the live stack, for a working session with a design agent.

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
- **F14, "Your turn" fires on notes you cannot act on:** a topic waits when its latest note is open and no response is newer (`src/ui/queue/order.ts`, `threadWaits`). Plain notes get no keep or dismiss buttons, so the only way to clear the pill is to write a response, and nothing says so. This is the cause of F1.
- **F15, two topic screens already disagree:** the Everything page shows kept notes and responses on the page and open notes in the margin (`src/ui/everything/thread-page.tsx`). The Studio card shows everything in one list.
- **F16, retry exists but is hidden:** a failed run leaves its mode button enabled, and clicking it again is the retry (`src/ui/studio/sparring.tsx`). The reason shown is already Cortex's text, so the F8 gap is only the wording Cortex sends.

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
- The clickable prototype in the private `jcfischer/threva` repository (`try/proto` and `try/page` at commit `3816c84`) is the voice and layout reference.

## Known Cortex gaps this redesign will likely need

These are not filed yet. File each one once the matching decision is made.

- A display name for the model of a note or turn (F13).
- A readable reason for a failed thinking run (F8, Q8).
- Which note, if any, asks the principal something, and its question text (Q3).
- Display text for note triggers, or a stable trigger id the catalog can translate (Q7).
- Optional: a maintained topic summary (Q4, O3).

## Outcome

Decided 2026-11-14, after three prototype rounds on the branch `prototype/studio-redesign` (variants A to I, started with `bun run proto:studio`). The principal rejected the first two rounds: A to C rearranged the old screen, and D to F reduced the Studio to answering questions. The Studio is a place to make things, so the direction is a work desk. Variant H is the chosen design.

### The design: a work desk on a wide screen

After Scott Jenson's Akademy 2026 talk (from 32:34): the work sits full size in the middle, and everything else is parked small at the edges.

| Code | Decision |
|---|---|
| D1 | **The draft is the centre.** The topic's question, the stand as its lead, then the thing being made, in the Markdown editor of the Everything view (`NoteEditor`). |
| D2 | **Material is parked on the left, the assistant's notes on the right**, as small dimmed cards in fixed places. Notes that wait are lit. Older notes shrink and fade. |
| D3 | **A card opens outwards** (variant H): outside its own column, level with the parked card. The draft never moves and is never covered. On a narrower window the card shrinks, then overlaps its own column. |
| D4 | **A card is used by working it in.** A button on the card, or a drop on a line of the draft, adds it after that paragraph. |
| D5 | **The assistant never writes as the principal.** What is worked in arrives as a marked quote with its source. A mark in the margin reopens the source card. |
| D6 | **Asking about a passage returns questions, never a rewrite.** Two acts on a selection: "Find holes in this" and "Ask me about this". There is no "Shorten" on the desk. |
| D7 | **Every request shows its state:** asked, promised, delivered, then accepted or declined by the principal, or "could not" with a readable reason and "Try again". |
| D8 | **No chat pane.** Every request is tied to a passage or a card, and its answer stays as a card. |
| D9 | **The history is a strip at the bottom:** one block per event. A click brings that card back. |

### What happened to the first-round answers

| Code | Status |
|---|---|
| Q1 | Replaced by D1 to D3. The topic lives on the desk, not on a row page. |
| Q2 | Replaced by D4, D6 and D8. Answering a waiting note stays, on its card. |
| Q3 | Stands: Cortex sends which note asks something, and the question. |
| Q4 | Replaced by D2 and D9. |
| Q5 | Partly open: the stand is the draft's lead. Its history has no place on the desk yet. |
| Q6 | Replaced by D6. Personas and the other sparring modes have no place on the desk yet. |
| Q7 | Stands in spirit: a card shows only how long ago. |
| Q8 | Replaced by D7. |
| Q9 | Stands: inbox captures and topic proposals as Day cards. Not prototyped. |
| Q10 | Open: parking and finishing a topic have no place on the desk yet. |

### Still open

- One draft per topic, or several pieces to switch between.
- What the Day card shows. Proposed: the one waiting question, answerable in place, and "Open the desk" (close to variant D).
- Screens under about 1100 pixels, where the three zones stack.
- Thinking overnight: where it is switched on, and how many notes a night may bring. Decided as D15 to D20 below.
- Q5, Q6 and Q10 above.

### Research behind D5 to D8

A research pass on augmented work (Engelbart, Licklider, Kay, Flores, Raskin and current studies) is the source of D5 to D8. Its strongest findings: writers who get suggestions react to them before finishing their own thinking and still feel in control (Bhat et al., CHI 2026, arxiv.org/abs/2603.10374); feedback framed as questions improves judgment (Danry et al.); a request is a commitment that someone has to close (Winograd and Flores). The citations were collected by an agent and not re-checked.

### Proposed build nodes

First proposal; what was filed is listed under "Filed" below. One vertical slice each, in this order.

1. **The desk opens, read-only:** from a Studio Day card and from the topic's row. Question, stand, notes on the right with waiting ones lit, material on the left, on today's API.
2. **Cards open outwards (D3)** with answer, keep and dismiss on a note card.
3. **The Day card is answerable in place** and links to the desk.
4. **The draft (D1):** blocked on the Cortex gap "a draft per topic".
5. **Working in (D4, D5):** button and drop on a line, quote with source, margin marks.
6. **Asking about a passage (D6, D7):** blocked on the Cortex gaps for passage requests and request states.
7. **The history strip (D9)** from the topic's `log`.
8. **The narrow screen.**

### Cortex gaps this design needs

First proposal; what was filed is listed under "Filed" below. They replace the list under "Known Cortex gaps" where they overlap.

- **A draft per topic:** a Markdown work document Cortex stores with the topic. The largest gap; nodes 4 to 6 wait on it.
- **The question a note asks,** and a one-line gist of each note (Q3, D2).
- **A request tied to a passage** that returns questions, not a rewrite (D6).
- **Request states:** asked, promised with a due time, delivered, and a readable reason when it fails (D7). Replaces "Thinking failed · exit -1".
- **Why a material item is linked,** and a way to add material from the desk (F9).
- **A display name for the model** (F13). Lower priority: the desk does not show the model on a card.

### Filed on 2026-11-14

- Decision: jcfischer/threva-app#89, closed with variant H.
- Build nodes 1, 2 and 7 above: jcfischer/threva-app#90, #91 (after #90) and #92 (after #91).
- Cortex gaps: the-metafactory/cortex#3652 (the question a note asks, and its gist) and #3653 (request states and a readable failure).
- Not filed: the draft and what waits on it (nodes 4 to 6, and the gaps for a draft and for passage requests), the Day card (node 3) and the narrow screen (node 8), until their open questions are answered. The material gap is not filed because it is unverified whether a capture to a topic already covers adding material.

### Open questions, answered 2026-11-14

| Code | Answer |
|---|---|
| Q11 | One draft per topic. |
| Q13 | Narrow screens: the zones stack and cards open in place. The desk is a wide-screen tool. |
| Q14 | Overnight thinking is a switch on the desk, shown as a standing promise, with at most three notes a night. It may also draw on other open topics (the-metafactory/cortex#3495, #3421); such a note names the topic it comes from. |
| Q16 | Personas and the other sparring modes are dropped from the desk. |
| Q12, Q15, Q17 | Open. They turn on one question: is a topic a question, a deliverable or both. Cortex already stores `type: question | topic | making` per thread; Threva ignores it today. |

### Question or task, decided 2026-11-14

| Code | Decision |
|---|---|
| D10 | **A topic has one of Cortex's three types, and the desk reads it.** `question`: the middle holds the answer being formed; it ends as decided, with what is expected and a review date. `making`: the middle holds the deliverable; it ends as shipped; it is also a task with a due date. `topic`: a collection of notes and material with no required draft; it does not end, but can be parked or dropped. |
| D11 | **The stand is demoted** (answers Q15, drops Q5). It is an optional one-line answer so far, only on `question` topics: on the Day card and in lists, and as one quiet line on the desk. It is not the draft's lead. |
| D12 | **A Day card for a topic says why it is there** (answers Q12): the assistant delivered something asked for (answerable in place), a `making` topic is due or planned today, or a decided question has reached its review date. |
| D13 | **Finishing follows the type** (answers Q17): a question asks for the decision, a making topic for "shipped"; both can be dropped. |
| D14 | **A request on the desk can start real work** (2026-11-14), such as a research pass or a build, not only thinking. The work runs in Cortex and its agents; Threva asks and shows. What kinds of work, how outside effects are approved and what unit is handed to a builder are open (Q18 to Q21). |

Destination the principal named: design work like this redesign session (a brief, prototypes, a research pass, decisions, filed nodes) should be doable in Threva as a `making` topic. Not specified yet.

Filed after these answers: the-metafactory/cortex#3655 (one draft per thread), and a ruling on jcfischer/threva-app#90 that applies D11. Ranger took #90 the same evening (pull request #93).

### Work requests, answered 2026-11-14

| Code | Answer |
|---|---|
| Q18 | The first kinds of work are research and prototype. A build that lands code follows. |
| Q19 | Not per-act approval. Agentic work produces many issues and pull requests, and reviewing each is not a good use of the principal's time. Threva supports autonomous work as ranger does it: the principal sees results and exceptions, not every step. Decided shape: a grant set once per topic says what the work may do without the principal, with a budget in time or tokens. The desk lights only exceptions: a fork the agent cannot decide, work that is stuck or out of budget, an act outside the grant. Everything else collapses into a count. The deliverable still arrives as a card, and accepting or declining it is the one required act. |
| Q20 | Cortex owns a generic job with an executor behind it; ranger on the work graph is the first executor. The desk never learns about nodes. Related wish, outside this redesign: ranger's state should not live in GitHub, because large maps and API quotas have caused failures. |
| Q21 | Decisions live in the draft, as a section the desk marks, and show as events in the history strip. No new kind of entry. |

What exists for Q20, from a read of Cortex, Soma and ranger on 2026-11-14 (by an agent; the handoff endpoint was re-checked, the rest was not):

- Ranger already runs jobs with states (queued, running, succeeded, failed) in its own sqlite store, not in GitHub. Studio thinking is such a job: Cortex enqueues `ivy-think` through the ranger CLI.
- Cortex has a second start-and-track path, `POST /api/desk/task-handoff` (preview, hand, retry, discard, accept), which sends a task to an agent over the bus and brings the result back as a Desk card. It covers Balance tasks only.
- Exceptions already reach the Desk: ranger's "needs you" entries become the agent cards Threva shows.
- Grants exist in two places: a Cortex table of promotable actions, and a map's auto-merge setting.
- The work graph sits behind a forge port with GitHub and GitLab implemented. Moving ranger's state off GitHub means a third, local implementation of that port.

### Filed after the open questions, 2026-11-14

- Threva build nodes under jcfischer/threva-app#89: #96 (think tonight, park and finish from the desk, by type; after #91), #97 (the Day card shows the waiting note and takes the answer in place; after #90), #98 (retire the Studio card's open view; after #96 and #97).
- Rulings: on #90 the stand is one quiet line on `question` topics (D11); on #91 a card opens in place when the zones stack (Q13).
- Cortex nodes under the-metafactory/cortex#3555: #3655 (one draft per thread), #3656 (a thread starts a research or prototype job under a grant and receives its artifact; after #3653), #3657 (what a thread's type means: due dates, review dates and outcomes), #3658 (ask about a passage and get questions; after #3655).
- Held as placeholder nodes under jcfischer/threva-app#89, each blocked by its Cortex node, so they reach the frontier when that node closes: #102 (the draft and working in; after cortex#3655), #103 (passage requests and the request list; after cortex#3658 and #3653), #104 (work requests, grants and exceptions; after cortex#3656), #105 (the due and review reasons for a Day card; after cortex#3657). #106 (overnight thinking: its limit and notes from other topics) is open and unblocked.
- Node #90 merged (pull request #93) before its stand ruling was applied, so the desk on main still shows the stand as a lead on every topic. A ruling on #96 carries the fix.

### Overnight thinking, decided 2026-11-14

Grilled on jcfischer/threva-app#106. The switch itself is #96.

| Code | Decision |
|---|---|
| D15 | **The nightly limit is the engine's.** It is Ranger's `dailyRuns` for each policy, counted per UTC day across all topics, and it stays at 3 for local and 3 for cloud. Thinking usually runs on the cloud model, so in practice a desk gets three notes a night. Threva has no rule of its own that hides notes. |
| D16 | **The promise shows Cortex's number.** Until Cortex serves the limit and tonight's count, the promise is worded without a number. The budget resets at UTC midnight, and the principal accepted that. |
| D17 | **Relation notes share the same budget** as other notes. |
| D18 | **Threva shows relation notes now,** built against fixtures, so they appear once Cortex writes them. Every `relates` kind is shown: a link opens its `href`, and a goal or person relation shows its label. Keep and dismiss work as for ideas. |
| D19 | **Only a relation to another topic can be followed.** The note names that topic by its question. Following opens the topic as a card on the left, beside the draft, showing its question, its type, its newest note and "Open its desk". A parked or closed topic says so. An unknown slug is shown as plain text. Following never opens a conversation (D8). |
| D20 | **cortex#3421 (three alternatives on request) is not overnight thinking** and is dropped from this question. |

Filed: the-metafactory/cortex#3663 (a thread's thinking says its nightly limit and tonight's count), a comment on the-metafactory/cortex#3495 with D17 to D19, build node #112 (relation notes on the desk; after #91), grilling node #113 (the number in the promise; after cortex#3663), and a ruling on #96 (the promise without a number).

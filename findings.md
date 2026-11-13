# What the Threva prototype needs from the Cortex Desk API

Refs #2

## Basis

- Cortex commit read: `04e7a67aeb4a6ecb49273b0b2800779703f3eccc` (2026-11-13, "Desk adapters: cut Balance task creation over to the lifecycle writer (node #3343) (#3519)"), checkout at `~/work/mf/cortex`, clean tree.
- Cortex files read: `src/surface/mc/server.ts` (route table, lines 545–660, and the `/ws` upgrade), the handlers in `src/surface/mc/api/desk-*.ts` that the surfaces below touch, the types and contracts they return in `src/surface/mc/desk/` (`types.ts`, `interrupt.ts`, `classify.ts`, `mail-rules*.ts`, `mail-sweep.ts`, `ruling.ts`, `autonomy.ts`, `my-day*.ts`, `mirror.ts`, `routine-*-contract.ts`, `routine-command.ts`, `studio/format.ts`, `studio/view.ts`), `docs/desk/README.md`, `docs/desk/commands.md`, `docs/desk/routines.md` and `docs/desk-studio.md`.
- Prototype files read: `prototype/proto/one.de.js`, `inbox.de.js`, `studio.de.js` and `prototype/page/core.de.js`.

## How to read this

Each surface has a table. The **Status** column uses three values:

- **Served**: a Cortex route returns the data or performs the act today.
- **U** (UI can derive): the API returns everything needed, and the UI can compute the rest from it without new backend behaviour.
- **B** (backend gap): Cortex does not hold the data or cannot perform the act. It needs new behaviour in `the-metafactory/cortex`.

Each gap has a code (F1, F2, …) that the summary at the end collects. Routes are written as `METHOD path`. Unless a row says otherwise, writes pass Mission Control's rebind and identity gates and need no step-up code.

The one read that feeds most surfaces is `GET /api/desk`. It returns a `DeskView` (`desk/types.ts`): `items[]` (`DeskItem`), `today[]` and `ahead[]` (`DeskEvent`), `agents`, `goals`, `notes`, `areas`, `vips`, `autonomy`, `corrections`, `routines`, `mailRules`, `mailSweeps`, `mailDigests`, `myDay`, `mirror`, `calendarAvailability`, `ask`, `topN`, `displayName` and `studioBriefing`. A `DeskItem` carries `key`, `kind`, `source`, `area`, `urgency`, `title`, `why`, `score`, `actions`, `more`, `detail` (`summary`, `history`, `refs`, `links`, `evidence`, `precedents`), `excerpt`, `suggestion`, `eventKey`, `since`, `interrupt`, `question`, `explanation`, `reply`, `handoff`, `invitation` and `back`. Item kinds are `goal`, `sensor`, `agent-failed`, `agent-blocked`, `decision`, `grilling`, `escalation`, `mail`, `reminder`, `meeting`, `mail-rule`, `dmarc`, `mail-waiting`, `mail-handoff` and `adapter`.

## Cross-cutting gaps

These hold for every surface below, so they are stated once.

| Need | Status | Detail |
|---|---|---|
| German-first text | **B** (F1) | Cortex composes user-facing prose in English: item `title` and `why` from templates (for example `meetingItems` in `desk/interrupt.ts` writes `"…" starts at 10:00.` and `It starts in 5 minutes.`), action `label`s, `message` and `error` strings on every write, and the autonomy labels in `desk/autonomy.ts`. The UI cannot translate model or template prose reliably. Cortex needs either localised templates or structured reasons (a reason code plus its values) beside the prose. |
| Assistant name | **B** (F2) | The prototype names the assistant (`A_NAME`, "Mira"). Cortex hard-codes "Ivy" in messages (for example the conversation refusal in `api/desk-ask.ts`) and returns no assistant name in `DeskView`. |
| Live updates | U | The `/ws` socket carries no Desk change events. Its only Desk message is `desk.fence`. The UI polls `GET /api/desk` and `GET /api/desk/studio` (the Desk page polls the Studio every 30 seconds). Polling is enough for a first slice. |
| Setup | (note) | Most write routes answer 409 when their part is not configured: Ranger actions and rulings need `mc.desk.ranger`, the Studio needs `mc.desk.studio`, mail moves need `mc.desk.mail.actions`, routines need `mc.desk.routines`. A newcomer bundle has to configure these. That is bundle work, not an API gap. |

## 1. The card queue (`oneQueue` in `one.de.js`)

The prototype builds one ordered queue: a meeting about to start, a meeting that just ended, arrivals, waiting agents, fresh items, routines that wait or failed, the rest of today's list, done for you, the weekly review. Skip, pin and "next up" reorder it locally.

| Need | Served by | Status |
|---|---|---|
| The ranked items and a reason per item | `GET /api/desk`: `items[]` with `score`, `urgency`, `why`, `since` | Served |
| The prototype's order by card type (meetings, arrivals, agents, fresh, routines, own list, done for you, review) | `items[].kind`, `score`, `since` | U. Cortex ranks by `score` with its own rules (`docs/desk/README.md`, "How the Desk ranks items"). Threva can sort by `kind` and `since`. If the order is a product rule that every client must share, it belongs in Cortex's ranking instead. |
| "Warum jetzt" line and the order panel | `items[].why` | Served, in English (F1) |
| Skip ("Nicht jetzt"), pin, next up | none | U. This is view state for one session. |
| Rank corrections across sessions ("less like this", "always show") | `GET/POST/DELETE /api/desk/corrections`; `DeskView.corrections` | Served. The prototype has no such control yet. |
| "Nichts braucht dich jetzt. Du bist bis 13:50 frei." | `today[]` (`at`, `end`), `calendarAvailability` | U |

### 1.1 Meeting soon (`soonCard`)

| Need | Served by | Status |
|---|---|---|
| A card a few minutes before the meeting | `items[]` of kind `meeting`, made when an event starts within `interruptions.meetingMinutes`; `title`, `why`, `eventKey`, `actions` (`open` with `url` for Join, `detail`) | Served |
| Title, start, end, place | `today[]`: `title`, `at`, `end`, `note` (the location, when the event is not online), `online`, `url` | Served |
| With whom (`ev.with`) | none. The calendar source contract (`docs/desk/commands.md`, Source output) has no attendees field, and `DeskEvent` has none. | **B** (F3) |
| "Verstanden" (dismiss the card) | none | U. Session state; the item drops out when the meeting starts. |
| Things to raise, linked to the meeting (`ev.raise`, `ev.notes`) | none. No route stores a link from a task, thread or note to an event. | **B** (F4) |
| What was kept last time (`lastBlock`) | none | **B** (F5) |
| The assistant's brief with the adapter each fact came from, and what it could not read (`briefBlock`) | none. No route prepares a meeting brief. | **B** (F6) |

### 1.2 After a meeting (`afterCard2`)

| Need | Served by | Status |
|---|---|---|
| Offer the card once, when a meeting has just ended | `today[]` (`end` before now) | U. Cortex makes no "meeting ended" item. The UI can detect it; the dismissal ("Fertig", "Nichts zu notieren") then lives only in the browser. If it must survive a reload or another device, it is part of F4. |
| Note something from the meeting | `POST /api/desk/ask` then `POST /api/desk/create` with kind `note` or `task` | Served |
| File it under "Aus <meeting>" and list what was noted on the card | none. A created note or task carries no event reference. | **B** (F4) |

### 1.3 Arrivals in the queue

See section 3. Arrivals reach the queue as `items[]` of kind `mail`, `mail-waiting`, `mail-handoff` and `mail-rule`, and as `mailSweeps[]` and `mailDigests[]`.

### 1.4 Waiting agents ("Agent wartet")

| Need | Served by | Status |
|---|---|---|
| The agent that waits, and why | `items[]` of kind `agent-blocked`, `decision`, `grilling`, `escalation`, `agent-failed`; `title`, `why`, `detail`, `question` (`condition`, `reason`), `explanation` (`sentence`, `choices[]` with `label`, `consequence`, `ruling`) | Served |
| The options and "Erst das Gegenargument" | `explanation.choices[].consequence` | Served for agents. The consequence is one sentence per choice, not a separate counter-argument. |
| "Entscheiden und dem Agenten sagen" | `POST /api/desk/ruling` with `key`, `text`, `requestId`. Cortex records the ruling with `soma graph rule` and resumes the node through Ranger. | Served |
| Approve a node, retry a failed task | `POST /api/desk/action` with `action` (`ranger.approve`, `ranger.retry`) and `key` | Served |
| Agents at work (the Delegiert view) | `DeskView.agents`: `line`, `working[]` (`title`, `note`, `since`), `waiting` | Served |

### 1.5 Fresh items and today's own list

The prototype mixes questions, tasks and mail into one list and marks what is new since yesterday.

| Need | Served by | Status |
|---|---|---|
| Today's tasks and their order | `GET /api/desk/my-day`: `items[]`, `alternates[]`, `phase`, `cap`, `outline`, `inbox`, `wins`, `undos`, `revision`; also in `DeskView.myDay` | Served |
| "Erledigt" on a task | `POST /api/desk/my-day` with op `done` | Served |
| Put a source item (a mail) on the list | `POST /api/desk/my-day` with op `todo` (`key`, `fingerprint`), or `POST /api/desk/plan` for a proposed outline parent followed by op `source-plan` | Served |
| "Heute einplanen" into a free slot, "Eingeplant um 11:00" | op `today-add` puts a task on today's list without a time. Free slots can be computed from `today[]` and `calendarAvailability`. | U for the free slots. **B** (F7) to store a planned time. |
| "Neu seit gestern" | `items[].since` | U |
| Questions in the same queue | Studio threads are not `DeskItem`s. `GET /api/desk/studio` returns them, and "Ivy waits on you" follows a documented rule (the latest note is `open` and no response is dated at or after it). | U. The UI merges two lists. A single Desk item for a waiting thread would remove that merge (part of F8). |
| "Mira hat einen Vorschlag" on a question | Studio notes with `kind: stand` and `status: open` | Served |
| Options with a counter-argument for one's own question (`it.opts`, `it.counter`) | none for threads. The Studio offers sparring modes instead (`red-team`, `other-side`). | **B** (F9) if the decision card with options stays in the design |
| "Später überprüfen" (expectation and review date) | `POST /api/desk/studio/act` with act `close`, outcome `decided`, `expect`, `reviewOn` | Served |
| Mark a source as wrong or stale ("Das stimmt nicht oder ist veraltet") | none | **B** (F10) |
| Hand a row to an agent | Mail: `POST /api/desk/mail` with `ivy.hand`. Other rows: the ask kind `task` files a node on a configured map. | Served for mail and map tasks. A Balance task cannot be handed over directly (F11, **B**). |

### 1.6 Routines that wait or failed

See section 5.1.

### 1.7 Done for you and the weekly review

See sections 5.3 and 5.4.

## 2. The bar: capture, search and asking

The prototype has one input. While you type it suggests "Notieren", matching entries, and "Mira fragen". It recognises a question, a recurring task, and a thought that belongs to an existing entry.

| Need | Served by | Status |
|---|---|---|
| Turn text into a card (note, reminder, task, goal, calendar entry, Studio capture, conversation, routine) | `POST /api/desk/ask` with `text`, optional `area`; returns `proposal` (kind, fields, `alternative` conversation offer, `automatic` for captures when the grant is on), or a routine proposal when the text describes a recurring job | Served |
| Confirm the card | `POST /api/desk/create` with `requestId`, `kind`, `fields`; returns `id`, `message`, `url` | Served |
| Undo a filed capture | `POST /api/desk/capture/undo` with `id`, `requestId` | Served |
| Close a note or reminder | `POST /api/desk/notes/done` with `id` | Served |
| Suggestions while typing (keep, matches, ask) | none server-side; the prototype matches in the browser too | U. The index is `items[]`, `today[]`, `ahead[]`, `myDay.outline`, the Studio threads and `routines.installed`. |
| Search beyond what the Desk currently lists (closed threads, archived mail, done tasks) | no search route | **B** (F12) |
| Tell a question from a note before Enter | none | U, as in the prototype (`isQuestion`). The server decides the kind on submit. |
| "Das gehört zu etwas, das du schon hast" (merge offer) | For Studio captures, the filer matches a thought to an active thread when it is filed (`docs/desk-studio.md`, Capture filing). Nothing matches a thought to a Balance task, and nothing answers before submit. | Served for threads after submit. **B** (F13) for tasks and for an offer before filing. |
| "Notiert unter Alles › Bereich › Projekt" with "Ansehen" | `create` returns `message` and sometimes `url`, not the outline path | **B** (F14) |
| Ask the assistant and get a conversation | `POST /api/conversations/asks` starts one; the conversation host gets the Desk items and listed mail as sources (`conversationSources` in `server.ts`) | Served |
| The answer as a list of matching things, each with where it stands and "Öffnen" | A conversation answers in prose. No route returns structured hits. | U for a first slice (local matching plus the per-item status from `items[]`, `why`, notes). **B** (F15) if the answer must come from the model with structured references. |
| "Was hast du heute gemacht?" with undo per entry | `DeskView.autonomy.done[]` and `mailRules[]` (`lastRunAt`, `count`) | U |
| Voice in the bar | `POST /api/desk/voice/transcribe`, `POST /api/desk/voice/speak` | Served (not in the prototype) |

## 3. Arrivals (`inbox.de.js`)

The prototype sorts every signal (mail, chat, calendar invitation) into four outcomes: let go, attach to an entry, draft a reply, or ask. In the learning phase every signal asks; repeated answers lead to a rule offer; later the rules run and only drafts and real questions reach the card. Some arrivals may interrupt.

### 3.1 Signals and their gist

| Need | Served by | Status |
|---|---|---|
| Mail with sender, subject and gist | `items[]` of kind `mail`: `title`, `excerpt`, `detail.summary`, `detail.evidence`, `detail.precedents`, `suggestion`, `reply`, `suspicious` | Served |
| Calendar invitations | `items[].invitation` (`summary`, `when`, `start`, `end`, `location`, `organizer`, `recurring`, `status`) | Served |
| Chat signals ("Chat von Tim") | none. The source contract defines events and mail only. | **B** (F16) |
| The channel badge on an entry ("2 Mails · 1 Chat") | none. Cortex does not record which signals fed an entry. | **B** (F17), depends on F16 and on attach (3.2) |

### 3.2 The four outcomes

| Prototype outcome | Served by | Status |
|---|---|---|
| Let go (`drop`): archive | `POST /api/desk/mail` with `move` (`target` `archive`, `junk`, `trash`), `trash`, `unimportant`, `unsubscribe`; undo with `undo` and the move id | Served |
| Let go a whole group ("Alle 4 Newsletter weglegen?") | `mailSweeps[]` and `mailDigests[]` (`kind` `bundle`, `sweep`, `digest`; `basis` `similar`, `list`, `sender`, `age`, `day`; `mails[]`, `why`); act with `sweep`, undo with `sweep.undo` | Served. Cortex groups by similarity, list, sender, age or day, not by the prototype's classes (newsletter, notification, press release, confirmation). Mapping a group to a German class name is U if `basis` and the classifier category are enough. |
| "Im Mail lassen" (hide from Threva, leave the mail untouched) | none. The nearest acts are `snooze` and `unimportant`. | **B** (F18) |
| Attach to a Studio thread | `POST /api/desk/mail` with `studio.add` (`key`, `requestId`, `thread` or null, `reason`, `includeText`); `studio.propose` proposes a thread | Served |
| Attach to a task | `POST /api/desk/plan` proposes a Balance parent; `POST /api/desk/my-day` op `source-plan` files the mail as a task under it | Served as "file as a task", not as material on an existing task. Attaching to an existing task is **B** (F19). |
| Attach to a meeting ("an die Vorbereitung für Kickoff") | The classifier returns `meetingKey` and `suggestedAction: link-meeting` (`desk/classify.ts`); no route writes the link | **B** (F4) |
| Draft a reply | `POST /api/desk/mail` with `draft` (`key`, `body`); the draft goes to the Drafts folder and is never sent | Served for drafting. The prototype's "Senden" sends; Cortex never sends (`docs/desk/README.md`, "How the Desk acts"). Sending is **B** (F20) and a product decision. |
| "Selbst antworten" | `items[].detail.links` / mail `url` (`message:` links) opens the mail program | Served |
| Accept a moved meeting ("Zusagen") | `POST /api/desk/mail` with `invite.propose`, then `invite.reply` (`reply` `accept` or `decline`, `requestId`, `commitment`, `confirmed`) | Served |
| Ask: keep as an own entry ("Behalten") | `POST /api/desk/my-day` op `todo` (`key`, `fingerprint`) | Served |
| Ask: why it asks ("Das passt zu keinem Eintrag. Es wäre ein neues Mandat.") | `items[].why`, `mailDecision`, `yesFilter` | Served, in English (F1) |
| The suggested outcome per signal (`sug`: drop, attach, draft, ask) | The classifier's `category` (`action`, `reply`, `meeting`, `fyi`, `bulk`), `suggestedAction` (`reply`, `archive`, `link-meeting`, `task`, `none`) and `predictedAction` | U. The UI maps these onto the four outcomes. `DeskItem` exposes `suggestion`; whether every classifier field reaches the item needs a check against a live stack. |
| Undo any outcome | per act: `undo` (moves), `sweep.undo`, `not-phishing.undo`, capture undo, my-day op `undo` with a receipt | Served. Each kind has its own undo call; the UI dispatches by `autonomy.done[].action`, as the Desk page does (`undoBy` in `dashboard-v2/components/desk-view.tsx`). |

### 3.3 Learning phase and rule offers

| Need | Served by | Status |
|---|---|---|
| Learning phase: every signal asks until rules exist | Rules run only when the grant `mail.rules` is on and a rule is approved (`desk/autonomy.ts`, `desk/mail-rules.ts`) | U. The phase is "no approved rules yet", which `GET /api/desk/mail/rules` (`rules[]`) shows. Cortex has no explicit phase or two-week clock. |
| A rule offer after repeated answers | Cortex proposes a rule when the last `proposeAfter` mails (default 8) from one sender, domain or List-Id were all moved the same way; proposals arrive as `items[]` of kind `mail-rule`; answer with `POST /api/desk/mail/rules` op `approve`, `later` or `never` | Served, with a different trigger. The prototype offers after one group answer or two attaches. Changing the threshold is configuration (`mailRules.proposeAfter`). |
| Rule actions archive, junk, trash, digest | `RULE_ACTIONS` in `desk/mail-rules-schema.ts` | Served |
| A rule "attach what clearly fits an entry, without asking" | none. Rules only move mail. | **B** (F21) |
| The list of rules with delete | `GET /api/desk/mail/rules` (`id`, `sentence`, `on`, `count`, `lastRunAt`, `held`); ops `start`, `stop`, `delete`, `edit`, `create`, `undo` | Served |
| Let the assistant apply approved rules on its own | `POST /api/desk/autonomy` with `action: mail.rules`, `on` | Served |

### 3.4 Interruptions

| Need | Served by | Status |
|---|---|---|
| Which arrivals interrupt | Config `interruptions` (`meetingMinutes`, `mail`, `reminders`, `maxAgeMinutes`); fresh mail ranked for today interrupts when `mail` is on; `items[].interrupt.delivery` | Served as a stack-wide switch |
| Interrupt reasons: mail about a meeting today, a deadline today, mail from someone on the list | VIPs: `GET/POST/DELETE /api/desk/vips`. Meeting link: classifier `meetingKey`. No deadline field on mail. | Partly served. A "deadline today" reason is **B** (F22). |
| Switch one reason off ("Darf dich unterbrechen", `iToggle`) | none; the interrupt rules are configuration, not a Desk write | **B** (F23) |
| "War das wichtig genug?" feedback that turns a reason off | none | **B** (F23) |
| Hold an arrival until a running meeting ends | none in the push path | U for the open tab (compare `today[]` with now). **B** (F24) for pushes through a transport. |

## 4. The Studio (`studio.de.js`)

The prototype opens a question as a Studio in place of the card: the question, where I stand, the assistant's notes with keep, dismiss and discuss, material, relations, and sparring modes.

| Need | Served by | Status |
|---|---|---|
| Question, where I stand, state, areas, policy | `GET /api/desk/studio`: `active[]`, `parked[]`, `closed[]`, each with `question`, `stand`, `state`, `areas`, `policy`, `place`, `overCap`, `thinkTonight`, `outcome`, `expect`, `reviewOn` | Served |
| Notes by kind (note, stand, idea, relation) with status, trigger, time and reason | thread `notes[]`: heading time, `trigger`, `model`, `mode`, `run`, `kind`, `status`, `because`, `relates`, `sample` | Served |
| Keep, dismiss; keeping a stand replaces "Where I stand" | `POST /api/desk/studio/act` with act `keep` or `dismiss`, `thread`, `note` | Served |
| Discuss a note, then keep as is, keep reworded, or dismiss | `POST /api/desk/studio/session` ops `start`, `read`, `recover`, `say`, `end`, `save-message` | Served |
| Own idea, and an answer to the assistant | act `respond` (`thread`, `text`) writes a Responses entry | Served. The prototype shows an own idea as a note in the stream; Cortex keeps responses in their own list, so the UI interleaves them by time (U). |
| A question inside the thread, answered from the thread | session ("Talk it through" uses question, stand, notes, responses and material labels) | Served |
| "Herausfordern lassen" on an own idea | act `spar` with a mode | Served |
| Sparring modes: Durchdenken, Grill mich, Gegenseite, Red Team, Erste Prinzipien | act `spar` with `mode` `think`, `grill`, `other-side`, `red-team`, `first-principles` | Served |
| "Was würde Nico sagen?" | mode `persona:<name>` for names in `mc.desk.studio.personas` | Served for configured personas. A persona taken from the thread's own people is **B** (F25). |
| "Mira denkt nach" while a spar runs, and the failure reason | `StudioView.thinking`; the request stays pending until a note with that job's `run` appears | Served |
| Budget spent, buttons disabled with a reason | `thinking` view; the act's refusal message | Served |
| Material list | thread `material[]` (`kind`, `label`, `href`) | Served |
| Open a material item and read an excerpt | none. Material is a label and a link, and Cortex never fetches links (`docs/desk-studio.md`, Live discussions). | **B** (F26) |
| Relations: threads, coming up, people, earlier decisions, proposed relations | Derived on render from the Studio view plus the Desk's goals and events (`docs/desk-studio.md`, Thread page) | U, but the derivation (`desk/studio/relates.ts`, including the rare-word rule for the decision journal) lives in Cortex's page code. Threva may not import it, so it would reimplement product logic. Serve the relations in `GET /api/desk/studio` instead: **B** (F27). |
| People with a role ("Sara, Geschäftsleitung, deine Ansprechperson") | material items of kind `person` | Served; the role goes into the label |
| A person page: everything that has to do with one person | none | **B** (F12, search) |
| "Entschieden, abschliessen" | act `close` with `outcome` (`decided`, `shipped`, `dropped`), `text`, `expect`, `reviewOn` | Served |
| "Parken", bring back | acts `park`, `unpark` (`park` names a thread to park when every place is used; 409 with `needsPark`) | Served |
| Think tonight | act `think` with `on` | Served |
| Open a new thread from a capture or proposal | act `open` with `from`, `id`, `area`, `answers` (yes-filter) | Served |
| Stacked navigation, breadcrumbs, Esc goes back | none | U |
| "n offen von Mira" | notes with `status: open` | U |

## 5. Routines, rulings, done for you, the weekly review and meetings (`core.de.js`)

### 5.1 Routines

| Need | Served by | Status |
|---|---|---|
| Routine list with schedule, policy, pause state | `DeskView.routines.installed[]` (`title`, `words` and the owner's fields); `GET /api/desk/routine-editor` for steps; `GET /api/desk/routine-occurrences` for planned starts | Served |
| A routine that waits for approval ("Routine wartet") | `routines.pending[]` (`decisionId`, `blueprintId`, `matchedAt`, `expiresAt`, `impulseSummary`) | Served |
| "Mach das", "Diesmal nicht" | `POST /api/desk/routines` with `action` `approve` or `deny`, `target`, `requestId` | Served |
| "Mach das, und frag nicht mehr", and the Erst fragen / Selbständig toggle | actions `auto` and `stop` | Served |
| Pause, resume | `GET /api/desk/routine-lifecycle` inspects and `POST /api/desk/routine-lifecycle` previews; `POST /api/desk/routines` with `action` `pause` or `resume`, `target`, `revision`, `proposedRevision`, `requestId` applies (`RoutineActionSchema` in `desk/routine-action-contract.ts`) | Served |
| A failed run ("Routine fehlgeschlagen") | `GET /api/desk/routine-history` (decisions with `approval` and executions with `state` `running`, `succeeded`, `failed`); `GET /api/desk/routine-log` for the log | Served for reading. The Desk derives "Needs attention" from this history (`docs/desk/routines.md`); the UI can do the same (U). |
| "Nochmal ausführen", "Jetzt ausführen" | none. The routine actions are `install`, `discard`, `remove`, `auto`, `stop`, `approve`, `deny`, plus the schedule, lifecycle and removal actions (`desk/routine-action-contract.ts`). None runs a routine now. | **B** (F28) |
| "Weglegen" on a failure | none | **B** (F29), or browser-only state if one device is enough |
| Last runs with their result | `routine-history`, `routines.done[]` | Served |
| Next run | `GET /api/desk/routine-occurrences` | Served |
| Create a routine from typed text ("jeden Montag …") | `POST /api/desk/ask` detects it and returns a routine proposal; `POST /api/desk/create` with kind `routine` installs it | Served |
| Ask the assistant to change a routine, with before and after | `POST /api/desk/routine-editor` (composer proposal, then apply) | Served |
| Schedule edits | `GET/POST /api/desk/routine-schedule` inspects and previews; `POST /api/desk/routines` with a schedule action applies | Served |
| Remove a routine | `GET /api/desk/routine-removal?id=…` inspects, then `POST /api/desk/routines` with a removal action | Served (not in the prototype) |
| Recipes (step lists shared by agents and routines) | `GET /api/desk/flows` | Served for listing. "Für eine Zeile verwenden" has no route (**B**, F30). |
| Background routines | `GET/POST /api/desk/routine-display` | Served |

### 5.2 Rulings

The prototype's decision card (`uPanel`: options, counter-argument, "Ich habe entschieden", "Lieber im Gespräch klären") covers two cases.

| Need | Served by | Status |
|---|---|---|
| A blocked agent's question, explained with choices | `items[].explanation`, `items[].question` | Served (see 1.4) |
| Record the ruling and resume the agent | `POST /api/desk/ruling` | Served |
| The same card for one's own question | Studio close with outcome `decided` | Served without options (F9) |
| "Lieber im Gespräch klären" | `POST /api/desk/studio/session` for threads; `POST /api/conversations/starts` from a source | Served |
| "Heute entschieden" log, copy as a handover | none as a list | U from closed threads (`closed[]` with `closed` date) and `autonomy.done[]`. Agent rulings made today are not listed (**B**, F31). |

### 5.3 Done for you

| Need | Served by | Status |
|---|---|---|
| What happened without me, with a reason | `DeskView.autonomy.done[]` (`key`, `action`, `title`, `message`, `at`, `ok`, `undo`, `stop`) | Served |
| Grouped by kind with a count ("Newsletter weggelegt · 4") | `done[].action` | U |
| Undo per entry or group | `done[].undo`, sent to the route for its action (mail move undo, `sweep.undo`, mail rule op `undo`, capture undo, capability uninstall) | Served per entry. A group undo is U (one call per entry). |
| "Erst fragen" (stop doing this on my own) | `POST /api/desk/autonomy` with `action`, `on: false`; `done[].stop` names a mail rule to stop | Served |
| Which action types may run on their own | `DeskView.autonomy.types[]` (`action`, `label`, `note`, `on`); promotable: `ranger.retry`, `studio.capture`, `mail.rules`, `capability.install` | Served |
| "Passt so" (dismiss the card) | none | U, session state |

### 5.4 The weekly review

| Need | Served by | Status |
|---|---|---|
| Offer the review | `DeskView.mirror.offered` (from `mc.desk.mirror` day and time) | Served |
| What you closed | `mirror.balance.wins[]`, `totalCompletions`, `focus[]` | Served |
| Where your time went, against what you want | `mirror.balance.areas[]` (`targetShare`, `actualShare`, `completions`), `mirror.calendar.areas[]` (hours) | Served |
| "Nächste Woche Platz schaffen", "Ich will vorerst weniger davon", "Das war eine Ausnahme" | Area weight could change through `POST /api/desk/my-day` op `edit` if an area is an outline node with a weight. Nothing records "make room next week" or "an exception". | **B** (F32). Whether op `edit` reaches areas needs a check against a live stack. |
| What was left lying, with keep, park, let go | Threads: `mirror.threads.parked`, act `park`, act `close` with `dropped`. Tasks: no staleness list in the mirror; op `defer` exists. | Partly served. A list of stale tasks is **B** (F33). |
| Decisions to check, with "Ist eingetreten", "Ist nicht eingetreten", "Zu früh" | `mirror.threads.reviews[]` (`slug`, `question`, `outcome`, `outcomeText`, `expect`, `reviewOn`) | Served for reading. No act records a review answer or moves `reviewOn` (**B**, F34). |
| Seen marks, "Rückblick abschliessen", and the next week's proposal following the answers | none | **B** (F35) |
| Mail and DMARC parts of the week | `mirror.mail`, `mirror.dmarc` | Served (not in the prototype) |

### 5.5 Meetings in the day and week views

| Need | Served by | Status |
|---|---|---|
| Today's events and the next days | `today[]`, `ahead[]`; `GET/PATCH /api/desk/calendars` for calendar visibility and colour | Served |
| Free time between meetings | `today[]`, `calendarAvailability` | U |
| Event detail: who, where, area, duration | `title`, `at`, `end`, `note`, `area`, `url`, `online` | Served except attendees (F3) |
| Questions that belong to a day of the week (`d.link`) | none | **B** (F4) |
| A new calendar entry from the bar | ask kind `calendar` | Served |

## Summary of gaps

### Backend gaps (need new behaviour in Cortex)

| Code | Gap | Surfaces |
|---|---|---|
| F1 | User-facing prose comes in English; no localisation or structured reasons | all |
| F2 | No assistant name in the API; "Ivy" is hard-coded | all |
| F3 | No attendees on calendar events | meetings |
| F4 | No link from a task, thread, note or mail to a meeting or a day (things to raise, "Aus <meeting>", attach to a meeting, questions per day) | meetings, arrivals, card queue |
| F5 | No record of what was kept in the last occurrence of a meeting | meetings |
| F6 | No meeting brief with per-fact sources and what could not be read | meetings |
| F7 | No planned time for a task on today's list | card queue |
| F8 | Waiting Studio threads are not Desk items, so the queue merges two lists | card queue |
| F9 | No options with counter-arguments for one's own question | card queue, rulings |
| F10 | No way to mark a source as wrong or stale | card queue |
| F11 | A Balance task cannot be handed to an agent | card queue |
| F12 | No search route (closed threads, archived mail, done tasks, a person) | bar, Studio |
| F13 | No match of a new thought to an existing task, and no offer before filing | bar |
| F14 | A create answer does not say where the entry was filed | bar |
| F15 | No structured answer to a question (hits with status and a reference) | bar |
| F16 | No chat source kind | arrivals |
| F17 | No record of which signals fed an entry | arrivals |
| F18 | No "hide from Threva, leave the mail alone" act | arrivals |
| F19 | No attach of a mail to an existing task as material | arrivals |
| F20 | Replies are drafted, never sent | arrivals |
| F21 | No rule that attaches mail without asking | arrivals |
| F22 | No deadline on mail as an interrupt reason | arrivals |
| F23 | Interrupt reasons are configuration; no per-reason switch and no feedback write | arrivals |
| F24 | Pushes are not held while a meeting runs | arrivals |
| F25 | No persona taken from a thread's people | Studio |
| F26 | Material has no excerpt or readable text | Studio |
| F27 | Relations are derived in Cortex's page code, not served | Studio |
| F28 | No run-now or retry for a routine | routines |
| F29 | No acknowledgement of a failed routine run | routines |
| F30 | No route to use a recipe for a row | routines |
| F31 | Agent rulings made today are not listed | rulings |
| F32 | Review answers about an area are not recorded | weekly review |
| F33 | No list of stale tasks for the review | weekly review |
| F34 | No act that records a decision review answer | weekly review |
| F35 | No review state (seen, closed) and no link from the answers to next week's proposal | weekly review |

### Gaps the UI can derive from what the API returns

- The card order by type and freshness, skip, pin and next up (`items[]`, `since`).
- Free slots in the day (`today[]`, `calendarAvailability`).
- The after-meeting card trigger (`today[].end`), with browser-only dismissal.
- Merging waiting Studio threads into the queue (`GET /api/desk/studio`, the documented "Ivy waits on you" rule).
- Suggestions while typing and question detection, over `items[]`, events, the outline, threads and routines.
- "Was hast du heute gemacht?" and the grouping of Done for you (`autonomy.done[]`).
- The learning phase as "no approved rules yet" (`GET /api/desk/mail/rules`).
- Mapping classifier fields to the four outcomes, and sweep groups to German class names.
- The interrupt hold for the open tab.
- "Needs attention" for routines from `routine-history`.
- The "Heute entschieden" list from closed threads and Done for you.
- Studio navigation, the open-note count, interleaving responses with notes.

Two of these are worth a second look in the Cortex grilling, because the UI would reimplement product rules: the card order (if it must hold for every client) and the Studio relations (F27).

### Checks that need a live stack

- Whether every classifier field (`category`, `suggestedAction`, `predictedAction`, `meetingKey`) reaches the mail item, or only `suggestion` and `why`.
- Whether `POST /api/desk/my-day` op `edit` changes an area's weight.

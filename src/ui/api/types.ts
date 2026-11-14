// The subset of Cortex's Desk API responses that Threva reads. Shapes follow
// Mission Control's JSON; Threva never imports Cortex code.

export type DeskItemKind =
  | "goal" | "sensor" | "agent-failed" | "agent-blocked" | "decision" | "grilling" | "escalation"
  | "mail" | "reminder" | "meeting" | "mail-rule" | "dmarc" | "mail-waiting" | "mail-handoff" | "adapter";

export interface DeskAction {
  id: string;
  label: string;
  role: "primary" | "secondary";
  wired: boolean;
  url?: string;
  target?: string;
}

export interface DeskLink {
  label: string;
  url: string;
}

export interface RulingChoice {
  label: string;
  consequence: string;
  ruling: string;
}

export interface DeskItem {
  key: string;
  kind: DeskItemKind;
  source: string;
  title: string;
  why: string;
  score: number;
  urgency: "now" | "today" | "this-week" | "waiting";
  actions: DeskAction[];
  detail: { summary: string; links: DeskLink[]; suspicion?: string[] };
  excerpt?: string;
  suggestion?: string;
  eventKey?: string;
  since?: number;
  todoFingerprint?: string;
  question?: { condition: string | null; reason: string };
  explanation?: { sentence: string; choices: RulingChoice[] };
  reply?: { to: string; subject: string };
  suspicious?: boolean;
  attention?: "action" | "update";
}

export interface DeskEvent {
  key: string;
  at: number;
  end?: number;
  title: string;
  note?: string;
  kind: "agent" | "agent-stop" | "meeting" | "all-day" | "reminder";
  url?: string;
  online?: boolean;
}

export interface TodayTask {
  task: { id: string; title: string };
  areaTitle: string;
}

// A task the day is done with. Cortex keeps no time for it.
export interface TodayWin {
  taskId: string;
  title: string;
}

export interface MailSweepMail {
  key: string;
  from: string;
  subject: string;
  url?: string;
}

export interface MailSweep {
  id: string;
  kind: string;
  target: "archive" | "junk" | "trash";
  label: string;
  title: string;
  why: string;
  mails: MailSweepMail[];
}

export interface DoneEntry {
  key: string;
  action?: string;
  undo?: string;
  title: string;
  message: string;
  at: number;
  ok: boolean;
}

export interface DeskView {
  generatedAt: number;
  displayName: string | null;
  items: DeskItem[];
  today: DeskEvent[];
  myDay?: { items: TodayTask[]; wins?: TodayWin[] };
  mailSweeps?: MailSweep[];
  mailDigests?: MailSweep[];
  autonomy?: { done: DoneEntry[] };
  routines?: RoutineView | null;
  agents?: DeskAgents;
  mirror?: { balance: { areas: AreaShare[] } | null };
}

export interface AreaShare {
  areaId: string;
  targetShare: number;
  actualShare: number;
}

export interface OutlineRow {
  id: string;
  title: string;
  weight: number;
  ordering: "parallel" | "sequential";
  children: OutlineRow[];
  done?: boolean;
  completedAt?: string;
  deferredUntil?: string;
  startDate?: string;
  dueDate?: string;
  repeat?: {
    unit: "day" | "week" | "month";
    interval: number;
    weekdays?: number[];
  };
  // Projected by Cortex; recurrence rules belong to the engine.
  recurrence?: { returnsOn: string | null; reappearsOn: string | null; finished: boolean };
  // The row's page as Markdown, and the details `outline-edit` sends back unchanged.
  note?: string;
  focusMonth?: string;
  context?: string;
  effort?: 1 | 2 | 4;
  estimateMinutes?: number | null;
}

export interface MyDayOutline {
  date: string;
  revision: number;
  outline: OutlineRow;
  // Rows Cortex owns for a Studio thread, which Threva shows without a page.
  studioTasks?: { id: string; slug: string }[];
  studioProjects?: { id: string; slug: string }[];
}

// Every detail of a row as `outline-edit` takes it. Threva sends the row's own values back unchanged.
export interface OutlineDetails {
  title: string;
  weight: number;
  note: string;
  ordering: "parallel" | "sequential";
  focus: boolean;
  dueDate: string;
  context: string;
  effort: 1 | 2 | 4;
  estimateMinutes: number | null;
}

export type OutlineCommand =
  | { op: "outline-add"; revision: number; parent: string; title: string; kind?: "task" }
  | { op: "outline-move"; revision: number; id: string; parent: string; index: number }
  | { op: "outline-edit"; revision: number; id: string; details: OutlineDetails; yes: boolean }
  | { op: "outline-complete" | "outline-reopen"; revision: number; id: string; confirm: true };

export interface RoutineView {
  installed: { title: string }[];
  pending: { decisionId: string; impulseSummary: string }[];
}

export interface DeskAgents {
  line: string;
  working: { title: string; note: string; since: number }[];
  waiting: number;
}

export type StudioNoteKind = "note" | "stand" | "idea" | "relation";
export type StudioNoteStatus = "open" | "kept" | "dismissed";

export interface StudioNote {
  at: string;
  trigger?: string;
  kind: StudioNoteKind;
  status: StudioNoteStatus;
  because?: string;
  text: string;
}

export interface StudioResponse {
  at: string;
  re?: string;
  text: string;
}

export interface StudioMaterial {
  kind: string;
  label: string;
  href?: string;
}

export type StudioOutcome = "decided" | "shipped" | "dropped";

// A Studio thread's thinking availability, as Cortex reports it per thread. The reason is Cortex's own wording.
export type ThinkingBudget = "open" | "spent" | "off";

export interface StudioThinkingRun {
  id: string;
  mode: string;
  status: "pending" | "failed";
  reason: string;
}

export type StudioThinking =
  | { kind: "unavailable"; reason: string }
  | { kind: "ready"; budget: ThinkingBudget; reason: string | null; runs: StudioThinkingRun[] };

export interface StudioThread {
  slug: string;
  state?: "active" | "parked" | "closed";
  closed?: string;
  outcome?: StudioOutcome;
  thinkTonight?: boolean;
  question: string;
  stand: string;
  notes: StudioNote[];
  responses: StudioResponse[];
  material?: StudioMaterial[];
  thinking?: StudioThinking;
}

export interface StudioList {
  studio: { personas?: string[]; active: StudioThread[]; parked?: StudioThread[]; closed?: StudioThread[] } | null;
}

// The sparring modes Cortex accepts: five fixed ones and one per configured persona.
export type SparMode = "think" | "grill" | "other-side" | "red-team" | "first-principles" | `persona:${string}`;

// The `POST /api/desk/studio/act` bodies Threva sends, without the request id.
export type StudioAct =
  | { act: "respond"; thread: string; text: string }
  | { act: "keep" | "dismiss"; thread: string; note: string }
  | { act: "park"; thread: string }
  | { act: "unpark"; thread: string }
  | { act: "think"; thread: string; on: boolean }
  | { act: "spar"; thread: string; mode: SparMode }
  | { act: "close"; thread: string; outcome: StudioOutcome; text: string; expect?: string; reviewOn?: string };

export interface MailRule {
  id: string;
  match: string;
  value: string;
  action: string;
  on: boolean;
  sentence: string;
}

export interface MailRules {
  rules: MailRule[];
}

export interface StudioProposal {
  thread: string | null;
  reason: string;
  threads: { slug: string; question: string }[];
}

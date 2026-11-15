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

export interface DeskMention {
  text: string;
  url: string;
}

export interface RulingChoice {
  label: string;
  consequence: string;
  ruling: string;
}

export interface InterruptReason {
  code: string;
  target?: string;
  eventKey?: string;
  dueAt?: string;
}

export interface DeskInterrupt {
  delivery: "off" | "held" | "pending" | "sending" | "sent" | "buffered" | "failed";
  reason?: InterruptReason;
  feedback?: "yes" | "no";
  held?: { eventKey: string; title: string; until: number };
  error?: string;
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
  more?: DeskAction[];
  detail: { summary: string; links: DeskLink[]; refs?: string[]; history?: string[]; suspicion?: string[] };
  mentions?: DeskMention[];
  excerpt?: string;
  suggestion?: string;
  eventKey?: string;
  since?: number;
  interrupt?: DeskInterrupt;
  todoFingerprint?: string;
  readOnly?: boolean;
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
  assistantName?: string;
  items: DeskItem[];
  today: DeskEvent[];
  myDay?: { date: string; items: TodayTask[]; wins?: TodayWin[] };
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
  recurrence?: { returnsOn: string | null; reappearsOn: string | null; finished: boolean };
  note?: string;
  focusMonth?: string;
  context?: string;
  effort?: 1 | 2 | 4;
  estimateMinutes?: number | null;
}

export interface StudioProject {
  id: string;
  slug: string;
  state: "active" | "parked" | "closed" | null;
  openNotes: number | null;
}

export interface MyDayOutline {
  date: string;
  revision: number;
  outline: OutlineRow;
  studioTasks?: { id: string; slug: string }[];
  studioProjects?: StudioProject[];
}

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

export type MyDayCommand =
  | OutlineCommand
  | { op: "todo"; key: string; fingerprint: string }
  | { op: "done"; id: string };

export interface MyDayChange {
  view: MyDayOutline;
  undo?: string;
  notice?: string;
}

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
  model?: string;
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

export type StudioThreadType = "question" | "topic" | "making";

export interface StudioThread {
  slug: string;

  type: StudioThreadType;
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

export type SparMode = "think" | "grill" | "other-side" | "red-team" | "first-principles" | `persona:${string}`;

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

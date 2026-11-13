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
  myDay?: { items: TodayTask[] };
  mailSweeps?: MailSweep[];
  mailDigests?: MailSweep[];
  autonomy?: { done: DoneEntry[] };
  routines?: RoutineView | null;
  agents?: DeskAgents;
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

export interface StudioNote {
  at: string;
  kind: string;
  status: string;
  text?: string;
}

export interface StudioThread {
  slug: string;
  question: string;
  stand: string;
  notes: StudioNote[];
  responses: { at: string; re?: string; text: string }[];
}

export interface StudioList {
  studio: { active: StudioThread[] } | null;
}

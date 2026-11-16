import type {
  AreaReview,
  AssistantNote,
  DeskAutonomy,
  DeskEvent as CortexDeskEvent,
  DeskInterrupt as CortexDeskInterrupt,
  DeskInterruptReason,
  DeskItem as CortexDeskItem,
  DeskLink as CortexDeskLink,
  DeskView as CortexDeskView,
  MailRuleView,
  MailSweepView,
  MyDayView,
  OutlineNode,
  RoutineView as CortexRoutineView,
  StudioThreadView,
  SweepMailView,
  ThreadOutcome,
  ThreadState,
  ThreadThinking,
  ThreadType,
} from "@the-metafactory/cortex/desk-api";

export type { DeskAction, DeskItemKind, DeskMention, RulingChoice, RulingExplanation, StudioResponse } from "@the-metafactory/cortex/desk-api";
export type {
  LogEntry as StudioLogEntry,
  MaterialLink as StudioMaterial,
  MyDayOutlineNode as OutlineRow,
  NoteKind as StudioNoteKind,
  NoteStatus as StudioNoteStatus,
  Recurrence as OutlineRepeat,
  StudioProjectLink as StudioProject,
  ThreadOutcome as StudioOutcome,
  ThreadThinking as StudioThinking,
  ThreadType as StudioThreadType,
} from "@the-metafactory/cortex/desk-api";

export type { MyDayCommand, OutlineCommand, OutlineDetails, SparMode, StudioAct } from "./requests";

export type DeskLink = Pick<CortexDeskLink, "label" | "url">;

export type InterruptReason = { code: string } & Omit<DeskInterruptReason, "code" | "phrase"> & {
  phrase?: DeskInterruptReason["phrase"];
};

export type DeskInterrupt = Omit<CortexDeskInterrupt, "reason"> & { reason?: InterruptReason };

export type DeskItemDetail = Omit<CortexDeskItem["detail"], "links" | "history" | "refs"> & {
  links: DeskLink[];
  history?: CortexDeskItem["detail"]["history"];
  refs?: CortexDeskItem["detail"]["refs"];
};

export type DeskItem = Omit<CortexDeskItem, "detail" | "interrupt"> & {
  detail: DeskItemDetail;
  interrupt?: DeskInterrupt;
};

export type DeskEvent = Pick<CortexDeskEvent, "key" | "at" | "end" | "title" | "kind" | "note" | "url" | "online">;

export type DeskAgents = CortexDeskView["agents"];
export type DoneEntry = DeskAutonomy["done"][number];
export type AreaShare = Pick<AreaReview, "areaId" | "targetShare" | "actualShare">;
export interface TodayTask {
  task: Pick<OutlineNode, "id" | "title">;
  areaTitle: string;
}
export type TodayWin = MyDayView["wins"][number];

export interface DeskDay {
  date: MyDayView["date"];
  items: readonly TodayTask[];
  wins?: readonly TodayWin[];
}

export type MailSweepMail = Pick<SweepMailView, "key" | "from" | "subject" | "url">;

export type MailSweep =
  Pick<MailSweepView, "id" | "kind" | "target" | "label" | "title" | "why"> & { mails: MailSweepMail[] };

export type MailRule = Pick<MailRuleView, "id" | "match" | "value" | "action" | "on" | "sentence">;

export interface MailRules {
  rules: MailRuleView[];
}

export interface RoutineView {
  installed: Pick<CortexRoutineView["installed"][number], "title">[];
  pending: Pick<CortexRoutineView["pending"][number], "decisionId" | "impulseSummary">[];
}

export type DeskView =
  Pick<CortexDeskView, "generatedAt" | "displayName"> & {
    items: DeskItem[];
    today: DeskEvent[];
    timeZone?: CortexDeskView["timeZone"];
    assistantName?: CortexDeskView["assistantName"];
    ahead?: DeskEvent[];
    myDay?: DeskDay;
    mailSweeps?: MailSweep[];
    mailDigests?: MailSweep[];
    autonomy?: Pick<DeskAutonomy, "done">;
    routines?: RoutineView | null;
    agents?: DeskAgents;
    mirror?: CortexDeskView["mirror"];
  };

export type MyDayOutline =
  Pick<MyDayView, "date" | "revision" | "outline"> &
  Partial<Pick<MyDayView, "studioProjects" | "studioTasks">>;

export interface MyDayChange {
  view: MyDayOutline;
  undo?: string;
  notice?: string;
}

export type StudioNote =
  Pick<AssistantNote, "at" | "kind" | "status" | "because" | "relates" | "text"> &
  Partial<Pick<AssistantNote, "trigger" | "model" | "mode" | "run">>;

type Thread = StudioThreadView;
export interface StudioThread {
  slug: Thread["slug"];
  question: Thread["question"];
  stand: Thread["stand"];
  notes: StudioNote[];
  responses: Thread["responses"];
  type?: ThreadType;
  state?: ThreadState;
  closed?: Thread["closed"];
  outcome?: ThreadOutcome;
  outcomeText?: Thread["outcomeText"];
  thinkTonight?: Thread["thinkTonight"];
  log?: Thread["log"];
  material?: Thread["material"];
  thinking?: ThreadThinking;
}

export interface StudioList {
  studio: {
    personas?: string[];
    active: StudioThread[];
    parked?: StudioThread[];
    closed?: StudioThread[];
  } | null;
}

export interface StudioProposal {
  thread: string | null;
  reason: string;
  threads: { slug: string; question: string }[];
}

export type StudioThinkingRun = Extract<ThreadThinking, { kind: "ready" }>["runs"][number];

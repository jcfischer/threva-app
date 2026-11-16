import type { DeskItem, MailRule, StudioProposal } from "../api/types";

export const OUTCOMES = ["archive", "attach", "draft", "ask"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export function suggestedOutcome(item: DeskItem): Outcome | null {
  const has = (id: string, primary = false) => item.actions.some((a) => a.id === id && (!primary || a.role === "primary"));
  if (has("meeting.show")) return "attach";
  if (has("mail.draft", true)) return "draft";
  if (item.attention === "update" || has("mail.archive", true)) return "archive";
  return null;
}

export type MoveTarget = "archive" | "junk" | "trash";
export type InviteReply = "accept" | "decline";

export const MAIL_ACTIONS = ["mail.spam", "mail.trash", "invite.accept", "invite.decline"] as const;
export type MailAction = (typeof MAIL_ACTIONS)[number];
export const MAIL_ACTION_DOES: Record<MailAction, { move: MoveTarget } | { invite: InviteReply }> = {
  "mail.spam": { move: "junk" },
  "mail.trash": { move: "trash" },
  "invite.accept": { invite: "accept" },
  "invite.decline": { invite: "decline" },
};

export const WAITING_ACTIONS = ["waiting.snooze", "waiting.done"] as const;
export type WaitingAction = (typeof WAITING_ACTIONS)[number];

export function wiredActions<T extends string>(item: DeskItem, ids: readonly T[]): T[] {
  const listed = [...item.actions, ...(item.more ?? [])];
  return ids.filter((id) => listed.some((a) => a.id === id && a.wired));
}

export const SNOOZE_TIMES = ["later", "tomorrow", "next-week"] as const;
export type SnoozeTime = (typeof SNOOZE_TIMES)[number];

export function proposedThread(proposal: StudioProposal): StudioProposal["threads"][number] | null {
  return proposal.thread ? (proposal.threads.find((th) => th.slug === proposal.thread) ?? null) : null;
}

export const requests = {
  move: (key: string, target: MoveTarget) => ({ action: "move", key, target }),
  waiting: (key: string, action: WaitingAction) => ({ action, key }),
  propose: (key: string) => ({ action: "studio.propose", key }),
  draft: (key: string, body: string) => ({ action: "draft", key, body }),
  snooze: (key: string, kind: SnoozeTime) => ({ action: "snooze", key, until: { kind } }),
  rule: (proposal: string, op: "approve" | "later" | "never") => ({ op, proposal }),
};

export function inLearningPhase(rules: readonly MailRule[] | null | undefined): boolean {
  return !rules || rules.length === 0;
}

export function isRuleOffer(item: DeskItem): boolean {
  return item.kind === "mail-rule" && item.actions.some((a) => a.id === "mailrule.approve");
}

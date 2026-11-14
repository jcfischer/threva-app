import type { DeskItem, MailRule, StudioProposal } from "../api/types";

export const OUTCOMES = ["archive", "attach", "draft", "ask"] as const;
export type Outcome = (typeof OUTCOMES)[number];

// Decision #30 maps classifier fields to outcomes: archive for category fyi or bulk or suggestedAction
// archive, attach for link-meeting or a thread match, draft for reply, ask otherwise. Cortex does not
// put category or suggestedAction on the item; it turns them into these structured fields, which
// Threva reads instead:
//   attention "update"          <- category fyi or bulk
//   primary action mail.archive <- suggested or learned archive
//   action meeting.show         <- suggestedAction link-meeting with the meeting on the Desk
//   primary action mail.draft   <- suggested or learned reply
// A mail whose classifier said action, task or none looks the same as an unclassified mail, so it
// gets no suggestion rather than "ask". A thread match is only known after studio.propose.
export function suggestedOutcome(item: DeskItem): Outcome | null {
  const has = (id: string, primary = false) => item.actions.some((a) => a.id === id && (!primary || a.role === "primary"));
  if (has("meeting.show")) return "attach";
  if (has("mail.draft", true)) return "draft";
  if (item.attention === "update" || has("mail.archive", true)) return "archive";
  return null;
}

export type MoveTarget = "archive" | "junk" | "trash";
export type InviteReply = "accept" | "decline";

// The actions Cortex lists on a mail that the card offers besides its four outcomes, each with what it does.
// Spam and Delete are moves, so they land in the same undo flow as Archive.
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

// The actions of `ids` the item lists with wired true, in its actions or under more, in the order of `ids`.
// Unlisted or unwired actions are left out.
export function wiredActions<T extends string>(item: DeskItem, ids: readonly T[]): T[] {
  const listed = [...item.actions, ...(item.more ?? [])];
  return ids.filter((id) => listed.some((a) => a.id === id && a.wired));
}

export const SNOOZE_TIMES = ["later", "tomorrow", "next-week"] as const;
export type SnoozeTime = (typeof SNOOZE_TIMES)[number];

// The thread the card names and studio.add sends. A proposed slug missing from the offered threads
// counts as no thread, so the label and the request never disagree.
export function proposedThread(proposal: StudioProposal): StudioProposal["threads"][number] | null {
  return proposal.thread ? (proposal.threads.find((th) => th.slug === proposal.thread) ?? null) : null;
}

// Request bodies for POST /api/desk/mail, /api/desk/my-day and /api/desk/mail/rules.
export const requests = {
  move: (key: string, target: MoveTarget) => ({ action: "move", key, target }),
  inviteReply: (key: string, reply: InviteReply, requestId: string) => ({ action: "invite.reply", key, reply, requestId, commitment: null, confirmed: true }),
  waiting: (key: string, action: WaitingAction) => ({ action, key }),
  propose: (key: string) => ({ action: "studio.propose", key }),
  attach: (key: string, proposal: StudioProposal, requestId: string) => {
    const thread = proposedThread(proposal)?.slug ?? null;
    const reason = thread ? proposal.reason.trim() : "";
    return { action: "studio.add", key, requestId, thread, includeText: false, ...(reason ? { reason } : {}) };
  },
  draft: (key: string, body: string) => ({ action: "draft", key, body }),
  keep: (key: string, fingerprint: string) => ({ op: "todo", key, fingerprint }),
  snooze: (key: string, kind: SnoozeTime) => ({ action: "snooze", key, until: { kind } }),
  rule: (proposal: string, op: "approve" | "later" | "never") => ({ op, proposal }),
};

// The learning phase lasts until the principal approved a first mail rule. When the rules list cannot
// be read (for example a stack without mail actions answers 409), no rule can run, so it counts as none.
export function inLearningPhase(rules: readonly MailRule[] | null | undefined): boolean {
  return !rules || rules.length === 0;
}

// A mail-rule item is a rule offer when it carries Cortex's approve action. A paused rule
// (mailrule:held:*) is a mail-rule item too, with release and stop actions instead.
export function isRuleOffer(item: DeskItem): boolean {
  return item.kind === "mail-rule" && item.actions.some((a) => a.id === "mailrule.approve");
}

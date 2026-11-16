import type { DeskClient, Result } from "./client";

export interface ConversationMeta {
  id: string;
  title: string;
  activity: { lastAt: string; status: "working" | "waiting" | "idle" };
}

export interface ConversationEntry {
  id: string;
  kind: string;
  role?: "user" | "assistant" | "tool" | "system";
  text?: string;
  error?: string;
  model?: string;
}

export interface ConversationDetail {
  conversation: ConversationMeta;
  models: { using: string | null };
  pending: { inputId: string; status: "queued" | "placed" | "done" | "unanswered"; reason?: string }[];
}

export interface SourceConversations {
  conversations: ConversationMeta[];
}

export interface Exchange {
  conversation: ConversationMeta;
  using: string | null;
  entries: ConversationEntry[];
  working: boolean;
}

/** The conversation Cortex already links to the thread, or null. Cortex lists the newest first. */
export async function linkedConversation(client: DeskClient, thread: string): Promise<string | null> {
  const r = await client.conversations.source(thread);
  return r.ok ? (r.data.conversations[0]?.id ?? null) : null;
}

export async function readExchange(client: DeskClient, id: string): Promise<Result<Exchange>> {
  const [detail, page] = await Promise.all([client.conversations.detail(id), client.conversations.entries(id)]);
  if (!detail.ok) return detail;
  if (!page.ok) return page;
  const { conversation, models, pending } = detail.data;
  const waiting = pending.some((p) => p.status === "queued" || p.status === "placed");
  return { ok: true, data: { conversation, using: models.using, entries: page.data.entries, working: waiting || conversation.activity.status === "working" } };
}

export interface SessionTurn {
  id: string;
  text: string;
  answer: { reply: string } | null;
  model: string;
}

export interface StudioSession {
  id: string;
  turns: SessionTurn[];
  phase: { kind: "open" | "ending" | "ended" };
}

export type SessionRequest =
  | { action: "start"; id: string; thread: string; scope: { kind: "ghost"; note: string } }
  | { action: "say"; id: string; turn: string; text: string }
  | { action: "end"; id: string; outcome: { kind: "leave" } };

/** What the card shows: user and assistant lines, and the failure of a turn. Tool and system entries stay out. */
export function lines(entries: readonly ConversationEntry[]): ConversationEntry[] {
  return entries.filter((e) => (e.role === "user" || e.role === "assistant") && (e.text || e.error));
}

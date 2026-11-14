import type { DeskClient, Result } from "./client";

// The subset of Cortex's conversation and Studio session routes that Threva reads and writes.

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

export const CONVERSATIONS_PATH = "/api/conversations";
export const STUDIO_SESSION_PATH = "/api/desk/studio/session";

const enc = encodeURIComponent;

export const sourceConversations = (client: DeskClient, thread: string): Promise<Result<SourceConversations>> =>
  client.get<SourceConversations>(`${CONVERSATIONS_PATH}/source?owner=studio-thread&id=${enc(thread)}`);

/** The conversation Cortex already links to the thread, or null. Cortex lists the newest first. */
export async function linkedConversation(client: DeskClient, thread: string): Promise<string | null> {
  const r = await sourceConversations(client, thread);
  return r.ok ? (r.data.conversations[0]?.id ?? null) : null;
}

export const startConversation = (client: DeskClient, thread: string, startId: string): Promise<Result<{ conversation: ConversationMeta }>> =>
  client.post(`${CONVERSATIONS_PATH}/starts`, { startId, source: { owner: "studio-thread", id: thread } });

export const sendInput = (client: DeskClient, id: string, inputId: string, text: string): Promise<Result<Record<string, unknown>>> =>
  client.post(`${CONVERSATIONS_PATH}/${enc(id)}`, { inputId, transport: "web", text, mode: "queue" });

export async function readExchange(client: DeskClient, id: string): Promise<Result<Exchange>> {
  const [detail, page] = await Promise.all([
    client.get<ConversationDetail>(`${CONVERSATIONS_PATH}/${enc(id)}`),
    client.get<{ entries: ConversationEntry[] }>(`${CONVERSATIONS_PATH}/${enc(id)}/entries?limit=500`),
  ]);
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

/** A refused turn still carries the session, with the text Cortex kept; the error text comes with it. */
export const sessionCall = (client: DeskClient, request: SessionRequest): Promise<Result<{ session: StudioSession }>> =>
  client.post(STUDIO_SESSION_PATH, request);

/** What the card shows: user and assistant lines, and the failure of a turn. Tool and system entries stay out. */
export function lines(entries: readonly ConversationEntry[]): ConversationEntry[] {
  return entries.filter((e) => (e.role === "user" || e.role === "assistant") && (e.text || e.error));
}

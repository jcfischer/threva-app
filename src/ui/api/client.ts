import type { ConversationDetail, ConversationEntry, ConversationMeta, SessionRequest, SourceConversations, StudioSession } from "./conversations";
import type { DeskView, MailRules, MyDayChange, MyDayCommand, MyDayOutline, StudioAct, StudioList } from "./types";

import type { DeskSearchResponse } from "@the-metafactory/cortex/desk-api";
export type { DeskSearchHit } from "@the-metafactory/cortex/desk-api";

export type Result<T> = { ok: true; data: T } | { ok: false; message: string | null; status: number };

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

async function readError(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === "string") return body.error;
    if (typeof body.message === "string") return body.message;
  } catch {}
  return null;
}

async function call<T>(fetchImpl: Fetch, path: string, init?: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetchImpl(path, init);
  } catch {
    return { ok: false, message: null, status: 0 };
  }
  if (!res.ok) return { ok: false, message: await readError(res), status: res.status };
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, message: null, status: res.status };
  }
}

export function newRequestId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function jsonPost<T>(fetchImpl: Fetch, path: string, body: unknown): Promise<Result<T>> {
  return call<T>(fetchImpl, path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

const PATHS = {
  desk: "/api/desk",
  action: "/api/desk/action",
  search: "/api/desk/search",
  ruling: "/api/desk/ruling",
  interruptionFeedback: "/api/desk/interruptions/feedback",
  mail: "/api/desk/mail",
  mailRules: "/api/desk/mail/rules",
  myDay: "/api/desk/my-day",
  ask: "/api/desk/ask",
  create: "/api/desk/create",
  captureUndo: "/api/desk/capture/undo",
  studio: "/api/desk/studio",
  studioAct: "/api/desk/studio/act",
  studioSession: "/api/desk/studio/session",
  outlineAsk: "/api/desk/outline/ask",
  contract: "/api/desk/contract",
  conversations: "/api/conversations",
  conversationAsks: "/api/conversations/asks",
  conversationStarts: "/api/conversations/starts",
} as const;

const enc = encodeURIComponent;
const dashedId = (): string => crypto.randomUUID();

export const asUuid = (id: string): string =>
  /^[0-9a-f]{32}$/i.test(id) ? `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}` : id;

type Json = Record<string, unknown>;
type Call<T> = Promise<Result<T>>;
type MailReply = "accept" | "decline" | "tentative" | (string & {});

export interface QueueCalls {
  desk(): Call<DeskView>;
  ruling(key: string, text: string, requestId?: string): Call<Json>;
  action(action: string, key: string): Call<Json>;
  interruptionFeedback(body: { key: string; code: string; target?: unknown; important: boolean }): Call<Json>;
}

export interface MailCalls {
  rules(): Call<MailRules>;
  rule(proposal: string, op: "approve" | "later" | "never"): Call<Json>;
  send<T = Json>(body: Json): Call<T>;
  inviteReply(key: string, reply: MailReply, requestId?: string): Call<{ message?: string }>;
  studioAdd(key: string, thread: string | null, reason?: string, requestId?: string): Call<{ message?: string }>;
}

export interface MyDayCalls {
  (): Call<MyDayOutline>;
  outline(): Call<MyDayOutline>;
  change(date: string, command: MyDayCommand, requestId?: string): Call<MyDayChange>;
}

export interface CaptureCalls {
  ask<T = Json>(text: string): Call<T>;
  create<T = Json>(kind: string, fields: Json, requestId?: string): Call<T>;
  undo(undo: { id: string; requestId: string }): Call<Json>;
}

export interface StudioCalls {
  (): Call<StudioList>;
  list(): Call<StudioList>;
  act(act: StudioAct, requestId?: string): Call<{ message?: string }>;
  session(request: SessionRequest): Call<{ session: StudioSession }>;
}

export interface ConversationCalls {
  ask(text: string, startId?: string): Call<Json>;
  start(thread: string, startId?: string): Call<{ conversation: ConversationMeta }>;
  source(thread: string): Call<SourceConversations>;
  send(id: string, inputId: string, text: string): Call<Json>;
  detail(id: string): Call<ConversationDetail>;
  entries(id: string): Call<{ entries: ConversationEntry[] }>;
}

export interface OutlineCalls {
  ask<T = Json>(body: Json, requestId?: string): Call<T>;
}

export interface DeskContract {
  version: string;
}

export type ContractCalls = () => Call<DeskContract>;

export interface DeskClient {
  search(query: string): Call<DeskSearchResponse>;
  desk(): Call<DeskView>;
  rules(): Call<MailRules>;
  changeMyDay(date: string, command: MyDayCommand): Call<MyDayChange>;
  queue: QueueCalls;
  mail: MailCalls;
  myDay: MyDayCalls;
  capture: CaptureCalls;
  studio: StudioCalls;
  conversations: ConversationCalls;
  outline: OutlineCalls;
  contract: ContractCalls;
}

export function createClient(fetchImpl: Fetch = (input, init) => fetch(input, init)): DeskClient {
  const read = <T,>(path: string) => call<T>(fetchImpl, path);
  const write = <T,>(path: string, body: unknown) => jsonPost<T>(fetchImpl, path, body);
  const outline = () => read<MyDayOutline>(PATHS.myDay);
  const change = (date: string, command: MyDayCommand, requestId: string = dashedId()) => write<MyDayChange>(PATHS.myDay, { date, requestId, command });
  const list = () => read<StudioList>(PATHS.studio);
  const desk = () => read<DeskView>(PATHS.desk);
  const rules = () => read<MailRules>(PATHS.mailRules);
  return {
    search: (query) => read(`${PATHS.search}?${new URLSearchParams({ q: query, kinds: "desk-note,desk-item,studio-capture,studio-thread" })}`),
    desk,
    rules,
    changeMyDay: (date, command) => change(date, command),
    queue: {
      desk,
      ruling: (key, text, requestId = newRequestId()) => write(PATHS.ruling, { key, text, requestId }),
      action: (action, key) => write(PATHS.action, { action, key }),
      interruptionFeedback: (body) => write(PATHS.interruptionFeedback, body),
    },
    mail: {
      rules,
      rule: (proposal, op) => write(PATHS.mailRules, { op, proposal }),
      send: (body) => write(PATHS.mail, body),
      inviteReply: (key, reply, requestId = dashedId()) =>
        write(PATHS.mail, { action: "invite.reply", key, reply, requestId, commitment: null, confirmed: true }),
      studioAdd: (key, thread, reason, requestId = newRequestId()) =>
        write(PATHS.mail, { action: "studio.add", key, requestId, thread, includeText: false, ...(reason ? { reason } : {}) }),
    },
    myDay: Object.assign(outline, { outline, change }),
    capture: {
      ask: (text) => write(PATHS.ask, { text }),
      create: (kind, fields, requestId = newRequestId()) => write(PATHS.create, { requestId, kind, fields }),
      undo: (undo) => write(PATHS.captureUndo, undo),
    },
    studio: Object.assign(list, {
      list,
      act: (act: StudioAct, requestId: string = newRequestId()) => write<{ message?: string }>(PATHS.studioAct, { ...act, requestId }),
      session: (request: SessionRequest) => write<{ session: StudioSession }>(PATHS.studioSession, request),
    }),
    conversations: {
      ask: (text, startId = dashedId()) => write(PATHS.conversationAsks, { text, startId }),
      start: (thread, startId = dashedId()) => write(PATHS.conversationStarts, { startId, source: { owner: "studio-thread", id: thread } }),
      source: (thread) => read(`${PATHS.conversations}/source?owner=studio-thread&id=${enc(thread)}`),
      send: (id, inputId, text) => write(`${PATHS.conversations}/${enc(id)}`, { inputId, transport: "web", text, mode: "queue" }),
      detail: (id) => read(`${PATHS.conversations}/${enc(id)}`),
      entries: (id) => read(`${PATHS.conversations}/${enc(id)}/entries?limit=500`),
    },
    outline: {
      ask: (body, requestId = dashedId()) => write(PATHS.outlineAsk, { requestId, ...body }),
    },
    contract: () => read<DeskContract>(PATHS.contract),
  };
}

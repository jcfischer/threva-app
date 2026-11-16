import type { DeskClient, Result } from "./client";
import { DESK_API_MAJOR } from "./desk-version";

export interface LoggedCall {
  name: string;
  args: unknown[];
}

export type Answer = Result<unknown> | ((...args: never[]) => Result<unknown> | Promise<Result<unknown>>);

export interface MemoryClient extends DeskClient {
  calls: LoggedCall[];
  seed(name: string, answer: Answer): void;
}

const UNSEEDED: Result<never> = { ok: false, message: null, status: 0 };

const GROUPS = {
  queue: ["desk", "ruling", "action", "interruptionFeedback"],
  mail: ["rules", "rule", "send", "inviteReply", "studioAdd"],
  capture: ["ask", "create", "undo"],
  conversations: ["ask", "start", "source", "send", "detail", "entries"],
  outline: ["ask"],
} as const;

const CALLABLE_GROUPS = { myDay: ["outline", "change"], studio: ["list", "act", "session"] } as const;
const FLAT = ["desk", "rules", "changeMyDay"] as const;

export function createMemoryClient(): MemoryClient {
  const calls: LoggedCall[] = [];
  const answers = new Map<string, Answer>([["handshake", { ok: true, data: { version: `${DESK_API_MAJOR}.0.0` } }]]);
  const named = (name: string) => (...args: unknown[]) => {
    calls.push({ name, args });
    const answer = answers.get(name);
    return Promise.resolve(typeof answer === "function" ? (answer as (...args: unknown[]) => Result<unknown> | Promise<Result<unknown>>)(...args) : (answer ?? UNSEEDED));
  };
  const client: Record<string, unknown> = {};
  for (const name of FLAT) client[name] = named(name);
  for (const [group, names] of Object.entries(GROUPS)) {
    client[group] = Object.fromEntries(names.map((name) => [name, named(`${group}.${name}`)]));
  }
  for (const [group, names] of Object.entries(CALLABLE_GROUPS)) {
    client[group] = Object.assign(named(group), Object.fromEntries(names.map((name) => [name, named(`${group}.${name}`)])));
  }
  client.handshake = named("handshake");
  return Object.assign(client as unknown as DeskClient, { calls, seed: (name: string, answer: Answer) => void answers.set(name, answer) });
}

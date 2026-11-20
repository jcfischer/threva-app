import type { DeskClient, Result } from "@desk/client";
import type { StudioAct } from "@desk/types";

type RevisionAct = Extract<StudioAct, { act: "park" | "close" }>;

export interface DraftConflict {
  text: string;
  revision: string;
}

/** The acts that park or close a topic, which Desk API 2 answers only for the draft revision the user was shown. */
export const carriesDraftRevision = (act: StudioAct): act is RevisionAct => act.act === "park" || act.act === "close";

/** A topic's draft revision as Cortex serves it, or null when Cortex serves no readable draft. */
export async function readDraftRevision(client: DeskClient, thread: string): Promise<string | null> {
  const read = await client.studio.draft(thread);
  return read.ok && typeof read.data.revision === "string" ? read.data.revision : null;
}

/** Cortex's 409 for a park or close whose thread moved on: the draft as it is now, and its revision. */
export function draftConflict(body: unknown): DraftConflict | null {
  if (!body || typeof body !== "object") return null;
  const fields = body as { text?: unknown; revision?: unknown };
  if (typeof fields.text !== "string" || typeof fields.revision !== "string") return null;
  return { text: fields.text, revision: fields.revision };
}

/** The draft revision Cortex serves with a refused park or close, so the retry carries the draft the user is now shown. */
export function refusedRevision(result: Result<unknown>): string | null {
  return result.ok ? null : draftConflict(result.body)?.revision ?? null;
}

/** The act carrying the revision Threva read with the topic, so an edit made since then answers 409 instead of passing silently. */
export function withDraftRevision(act: StudioAct, revision: string | null): StudioAct {
  return carriesDraftRevision(act) && revision !== null ? { ...act, draftRevision: revision } : act;
}

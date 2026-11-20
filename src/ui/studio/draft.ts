import type { DeskClient, Result } from "@desk/client";
import type { StudioAct } from "@desk/types";

type RevisionAct = Extract<StudioAct, { act: "park" | "close" }>;

/** The acts that park or close a topic, which Desk API 2 answers only for the draft revision the user was shown. */
export const carriesDraftRevision = (act: StudioAct): act is RevisionAct => act.act === "park" || act.act === "close";

/** A topic's draft revision as Cortex serves it, or null when Cortex serves no readable draft. */
export async function readDraftRevision(client: DeskClient, thread: string): Promise<string | null> {
  const read = await client.studio.draft(thread);
  return read.ok && typeof read.data.revision === "string" ? read.data.revision : null;
}

/** The draft revision Cortex serves with a refused park or close, so the retry carries the draft the user is now shown. */
export function refusedRevision(result: Result<unknown>): string | null {
  if (result.ok || typeof result.body !== "object" || result.body === null) return null;
  const revision = (result.body as { revision?: unknown }).revision;
  return typeof revision === "string" ? revision : null;
}

/** The act carrying the revision Threva read with the topic, so an edit made since then answers 409 instead of passing silently. */
export function withDraftRevision(act: StudioAct, revision: string | null): StudioAct {
  return carriesDraftRevision(act) && revision !== null ? { ...act, draftRevision: revision } : act;
}

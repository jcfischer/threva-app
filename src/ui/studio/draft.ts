import type { DeskClient } from "@desk/client";
import type { StudioAct } from "@desk/types";

type RevisionAct = Extract<StudioAct, { act: "park" | "close" }>;

/** The acts that park or close a topic, which Desk API 2 answers only for the draft revision the user was shown. */
export const carriesDraftRevision = (act: StudioAct): act is RevisionAct => act.act === "park" || act.act === "close";

/** A topic's draft revision as Cortex serves it, or null when Cortex serves no readable draft. */
export async function readDraftRevision(client: DeskClient, thread: string): Promise<string | null> {
  const read = await client.studio.draft(thread);
  return read.ok && typeof read.data.revision === "string" ? read.data.revision : null;
}

/** The act carrying the revision Threva read with the topic, so an edit made since then answers 409 instead of passing silently. */
export function withDraftRevision(act: StudioAct, revision: string | null): StudioAct {
  return carriesDraftRevision(act) && revision !== null ? { ...act, draftRevision: revision } : act;
}

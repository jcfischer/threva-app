import type { DeskClient } from "@desk/client";
import type { StudioAct, StudioDraft } from "@desk/types";

type RevisionAct = Extract<StudioAct, { act: "park" | "close" }>;

/** Every act that Cortex 2 refuses without the revision of the draft it parks or closes. */
export const carriesDraftRevision = (act: StudioAct): act is RevisionAct => act.act === "park" || act.act === "close";

export async function servedDraft(client: DeskClient, thread: string): Promise<StudioDraft | null> {
  const read = await client.studio.draft(thread);
  return read.ok ? read.data : null;
}

export async function withDraftRevision(client: DeskClient, act: StudioAct): Promise<StudioAct> {
  if (!carriesDraftRevision(act)) return act;
  const draft = await servedDraft(client, act.thread);
  return draft ? { ...act, draftRevision: draft.revision } : act;
}

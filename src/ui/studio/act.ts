import { useDeskAct } from "../act/use-act";
import { newRequestId, type DeskClient, type Result } from "../api/client";
import type { StudioAct } from "../api/types";
import { useQueue } from "../cards/act";

export const STUDIO_ACT_PATH = "/api/desk/studio/act";

/** Sends one Studio act to Cortex. The answer carries Cortex's message on success and its error text on a refusal. */
export function sendStudioAct(client: DeskClient, act: StudioAct, requestId: string = newRequestId()): Promise<Result<{ message?: string }>> {
  return client.post<{ message?: string }>(STUDIO_ACT_PATH, { ...act, requestId });
}

export function useStudioAct() {
  const { client, refresh } = useQueue();
  const { busy, error, act } = useDeskAct(refresh);
  const run = (studio: StudioAct) => act(studio, (requestId) => sendStudioAct(client, studio, requestId));
  return { busy, error, run };
}

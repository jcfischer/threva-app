import { useRef, useState } from "react";
import { newRequestId, type DeskClient, type Result } from "../api/client";
import type { StudioAct } from "../api/types";
import { useQueue, type ActError } from "../cards/act";

export const STUDIO_ACT_PATH = "/api/desk/studio/act";

/** Sends one Studio act to Cortex. The answer carries Cortex's message on success and its error text on a refusal. */
export function sendStudioAct(client: DeskClient, act: StudioAct, requestId: string = newRequestId()): Promise<Result<{ message?: string }>> {
  return client.post<{ message?: string }>(STUDIO_ACT_PATH, { ...act, requestId });
}

// No answer, or a server error, may mean the act was written. A retry of the same act reuses the request id, so
// Cortex answers it with the first commit instead of writing it twice.
const unsure = (result: Result<unknown>): boolean => !result.ok && (result.status === 0 || result.status >= 500);

export function useStudioAct() {
  const { client, refresh } = useQueue();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActError>(null);
  const last = useRef<{ key: string; id: string } | null>(null);
  async function run(act: StudioAct): Promise<Result<{ message?: string }>> {
    const key = JSON.stringify(act);
    const id = last.current?.key === key ? last.current.id : newRequestId();
    setBusy(true);
    setError(null);
    const result = await sendStudioAct(client, act, id);
    setBusy(false);
    last.current = unsure(result) ? { key, id } : null;
    if (result.ok) refresh();
    else setError({ message: result.message });
    return result;
  }
  return { busy, error, run };
}

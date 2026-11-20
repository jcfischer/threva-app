import { useEffect, useRef } from "react";
import type { StudioAct } from "@desk/types";
import { useDeskAct } from "../act/use-act";
import { useQueue } from "../cards/act";
import { readDraftRevision, refusedRevision, withDraftRevision } from "./draft";

/** The Studio acts, carrying the draft revision of the topic whose slug is given, read once when that topic loads. */
export function useStudioAct(thread: string | null = null) {
  const { client, refresh } = useQueue();
  const { busy, error, act } = useDeskAct(refresh);
  const revision = useRef<Promise<string | null>>(Promise.resolve(null));
  useEffect(() => {
    revision.current = thread === null ? Promise.resolve(null) : readDraftRevision(client, thread);
  }, [client, thread]);
  const run = async (studio: StudioAct) => {
    const result = await act(studio, async (requestId) => client.studio.act(withDraftRevision(studio, await revision.current), requestId));
    const next = result.ok ? null : refusedRevision(result);
    if (next !== null) revision.current = Promise.resolve(next);
    return result;
  };
  return { busy, error, run };
}

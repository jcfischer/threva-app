import { useEffect, useRef } from "react";
import type { StudioAct } from "@desk/types";
import { useDeskAct } from "../act/use-act";
import { useQueue } from "../cards/act";
import { readDraftRevision, refusedRevision, withDraftRevision, type DraftRead } from "./draft";

/** The Studio acts, carrying the draft revision of the topic whose slug is given, read when that topic loads and again at the act if that read failed. */
export function useStudioAct(thread: string | null = null) {
  const { client, refresh } = useQueue();
  const { busy, error, act } = useDeskAct(refresh);
  const revision = useRef<Promise<DraftRead>>(Promise.resolve({ revision: null }));
  useEffect(() => {
    revision.current = thread === null ? Promise.resolve({ revision: null }) : readDraftRevision(client, thread);
  }, [client, thread]);
  const run = async (studio: StudioAct) => {
    const shown = revision.current;
    const result = await act(studio, async (requestId) => {
      const read = (await shown) ?? (thread === null ? null : await readDraftRevision(client, thread));
      return client.studio.act(withDraftRevision(studio, read?.revision ?? null), requestId);
    });
    const next = refusedRevision(result);
    if (next !== null && revision.current === shown) revision.current = Promise.resolve({ revision: next });
    return result;
  };
  return { busy, error, run };
}

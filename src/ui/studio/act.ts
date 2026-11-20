import { useDeskAct } from "../act/use-act";
import { useQueue } from "../cards/act";
import type { StudioAct } from "@desk/types";
import { withDraftRevision } from "./draft";

export function useStudioAct() {
  const { client, refresh } = useQueue();
  const { busy, error, act } = useDeskAct(refresh);
  const run = (studio: StudioAct) => act(studio, async (requestId) => client.studio.act(await withDraftRevision(client, studio), requestId));
  return { busy, error, run };
}

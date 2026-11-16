import { useDeskAct } from "../act/use-act";
import { useQueue } from "../cards/act";
import type { StudioAct } from "../api/types";

export function useStudioAct() {
  const { client, refresh } = useQueue();
  const { busy, error, act } = useDeskAct(refresh);
  const run = (studio: StudioAct) => act(studio, (requestId) => client.studio.act(studio, requestId));
  return { busy, error, run };
}

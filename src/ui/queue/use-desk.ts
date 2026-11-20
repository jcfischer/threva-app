import { useCallback, useEffect, useRef, useState } from "react";
import type { DeskClient } from "@desk/client";
import type { Startup } from "@desk/startup";
import type { DeskView, StudioList } from "@desk/types";

export const POLL_MS = 15_000;

export interface DeskState {
  view: DeskView | null;
  studio: StudioList | null;
  error: { message: string | null } | null;
}

export async function loadDesk(client: DeskClient, previous: DeskState): Promise<DeskState> {
  const [desk, studio] = await Promise.all([client.desk(), client.studio()]);
  if (!desk.ok) return { ...previous, error: { message: desk.message } };
  return {
    view: desk.data,
    studio: studio.ok ? studio.data : previous.studio,
    error: null,
  };
}

export function useDesk(client: DeskClient, startup: Startup = { state: "ready" }): DeskState & { refresh: () => void } {
  const [state, setState] = useState<DeskState>({ view: null, studio: null, error: null });
  const latest = useRef(state);
  latest.current = state;
  const ready = startup.state === "ready";

  const refresh = useCallback(() => {
    if (!ready) return;
    void loadDesk(client, latest.current).then(setState);
  }, [client, ready]);

  useEffect(() => {
    if (!ready) return;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh, ready]);

  const error = startup.state === "failed" ? { message: startup.message } : state.error;
  return { ...state, error, refresh };
}

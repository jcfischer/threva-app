import { useCallback, useEffect, useRef, useState } from "react";
import type { DeskClient } from "../api/client";
import type { DeskView, MailRule, StudioList } from "../api/types";

export const POLL_MS = 15_000;

export interface DeskState {
  view: DeskView | null;
  studio: StudioList | null;
  rules?: MailRule[] | null;
  error: { message: string | null } | null;
}

export async function loadDesk(client: DeskClient, previous: DeskState): Promise<DeskState> {
  const [desk, studio, rules] = await Promise.all([client.desk(), client.studio(), client.rules()]);
  if (!desk.ok) return { ...previous, error: { message: desk.message } };
  return {
    view: desk.data,
    studio: studio.ok ? studio.data : previous.studio,
    rules: rules.ok ? rules.data.rules : (previous.rules ?? null),
    error: null,
  };
}

export function useDesk(client: DeskClient): DeskState & { refresh: () => void } {
  const [state, setState] = useState<DeskState>({ view: null, studio: null, rules: null, error: null });
  const latest = useRef(state);
  latest.current = state;

  const refresh = useCallback(() => {
    void loadDesk(client, latest.current).then(setState);
  }, [client]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { ...state, refresh };
}

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { DeskClient, Result } from "../api/client";
import { allowsCardKey, type EnterAct } from "../queue/keys";

export interface QueueContextValue {
  client: DeskClient;
  refresh: () => void;
}

export const QueueContext = createContext<QueueContextValue | null>(null);

export function useQueue(): QueueContextValue {
  const value = useContext(QueueContext);
  if (!value) throw new Error("QueueContext is missing.");
  return value;
}

export type ActError = { message: string | null } | null;

export function useAct(enter?: EnterAct) {
  const { client, refresh } = useQueue();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActError>(null);
  const inFlight = useRef(false);
  async function run<T = Record<string, unknown>>(path: string, body: unknown): Promise<Result<T>> {
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const result = await client.post<T>(path, body);
    inFlight.current = false;
    setBusy(false);
    if (result.ok) refresh();
    else setError({ message: result.message });
    return result;
  }
  const perform = () => {
    if (enter && !inFlight.current) return run(enter.path, enter.body);
  };
  useEffect(() => {
    if (!enter) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || !allowsCardKey(event)) return;
      event.preventDefault();
      void perform();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return { busy, error, run, perform };
}

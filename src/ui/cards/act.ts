import { createContext, useContext, useState } from "react";
import type { DeskClient, Result } from "../api/client";

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

export function useAct() {
  const { client, refresh } = useQueue();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActError>(null);
  async function run<T = Record<string, unknown>>(path: string, body: unknown): Promise<Result<T>> {
    setBusy(true);
    setError(null);
    const result = await client.post<T>(path, body);
    setBusy(false);
    if (result.ok) refresh();
    else setError({ message: result.message });
    return result;
  }
  return { busy, error, run };
}

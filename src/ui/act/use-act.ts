import { useRef, useState } from "react";
import { newRequestId, type Result } from "@desk/client";

export type ActError = { message: string | null; body?: unknown } | null;

export type ActCall<T> = (requestId: string) => Promise<Result<T>>;

/** A refused act's message and body, in the shape the error lines and the draft conflict read. */
export const actError = (result: Extract<Result<unknown>, { ok: false }>): ActError => ({ message: result.message, body: result.body });

export type DeskAct = <T>(identity: unknown, call: ActCall<T>) => Promise<Result<T>>;

export const WRITE_LANDED = 200;

const mayHaveBeenWritten = (result: Result<unknown>): boolean => !result.ok && (result.status === 0 || result.status >= 500);

export function useDeskAct(refresh?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActError>(null);
  const inFlight = useRef(false);
  const last = useRef<{ key: string; id: string } | null>(null);
  async function act<T>(identity: unknown, call: ActCall<T>): Promise<Result<T>> {
    if (inFlight.current) return { ok: false, message: null, status: 0 };
    const key = JSON.stringify(identity);
    const id = last.current?.key === key ? last.current.id : newRequestId();
    inFlight.current = true;
    setBusy(true);
    setError(null);
    let result: Result<T>;
    try {
      result = await call(id);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    last.current = mayHaveBeenWritten(result) ? { key, id } : null;
    if (result.ok) refresh?.();
    else setError(actError(result));
    return result;
  }
  return { busy, error, act, isInFlight: () => inFlight.current };
}

import { useState } from "react";

const STORAGE_KEY = "threva.dismissedMeetings";

function read(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(keys: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(keys.slice(-50)));
  } catch {}
}

export function useDismissedMeetings(): [readonly string[], (key: string) => void] {
  const [keys, setKeys] = useState<readonly string[]>(read);
  const dismiss = (key: string) => {
    const next = [...keys.filter((k) => k !== key), key];
    setKeys(next);
    write(next);
  };
  return [keys, dismiss];
}

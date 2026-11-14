import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { DeskClient, Result } from "../api/client";
import type { DeskItem, MyDayChange, MyDayCommand } from "../api/types";
import { allowsCardKey, type EnterAct } from "../queue/keys";

export interface QueueContextValue {
  client: DeskClient;
  refresh: () => void;
  // The My Day date Cortex returned with the Desk. Without it a card cannot change My Day.
  myDayDate?: string;
  // Tells the queue that a card's item became a task, so the queue can say so after the card is gone.
  onTask?: (title: string) => void;
}

export const QueueContext = createContext<QueueContextValue | null>(null);

export function useQueue(): QueueContextValue {
  const value = useContext(QueueContext);
  if (!value) throw new Error("QueueContext is missing.");
  return value;
}

export type ActError = { message: string | null } | null;

// An item Cortex lets the person move into today's Inbox: it carries a fingerprint and is not read-only.
export function canMakeTask(item: DeskItem): boolean {
  return !!item.todoFingerprint && !item.readOnly;
}

export function useAct(enter?: EnterAct) {
  const { client, refresh, myDayDate, onTask } = useQueue();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActError>(null);
  const inFlight = useRef(false);
  async function settle<T>(request: () => Promise<Result<T>>): Promise<Result<T>> {
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const result = await request();
    inFlight.current = false;
    setBusy(false);
    if (result.ok) refresh();
    else setError({ message: result.message });
    return result;
  }
  const run = <T = Record<string, unknown>>(path: string, body: unknown) => settle(() => client.post<T>(path, body));
  const changeMyDay = (command: MyDayCommand) =>
    settle<MyDayChange>(async () => (myDayDate ? client.changeMyDay(myDayDate, command) : { ok: false, message: null, status: 0 }));
  const makeTask = async (item: DeskItem) => {
    if (!item.todoFingerprint || inFlight.current) return;
    const result = await changeMyDay({ op: "todo", key: item.key, fingerprint: item.todoFingerprint });
    if (result.ok) onTask?.(item.title);
  };
  const perform = () => {
    if (!enter || inFlight.current) return;
    return "myDay" in enter ? changeMyDay(enter.myDay) : run(enter.path, enter.body);
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
  return { busy, error, run, perform, makeTask, canChangeMyDay: !!myDayDate };
}

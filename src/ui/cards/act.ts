import { createContext, useContext, useEffect } from "react";
import { useDeskAct, type ActError as SharedActError } from "../act/use-act";
import type { DeskClient } from "@desk/client";
import type { DeskItem, MyDayChange, MyDayCommand } from "@desk/types";
import { allowsCardKey, type EnterAct } from "../queue/keys";

export interface QueueContextValue {
  client: DeskClient;
  refresh: () => void;
  myDayDate?: string;
  onTask?: (title: string) => void;
}

export const QueueContext = createContext<QueueContextValue | null>(null);

export function useQueue(): QueueContextValue {
  const value = useContext(QueueContext);
  if (!value) throw new Error("QueueContext is missing.");
  return value;
}

const dashed = (id: string): string => id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");

export type ActError = SharedActError;

function canMakeTask(item: DeskItem): boolean {
  return !!item.todoFingerprint && !item.readOnly;
}

export function useAct(enter?: EnterAct) {
  const { client, refresh, myDayDate, onTask } = useQueue();
  const { busy, error, act, isInFlight } = useDeskAct(refresh);
  const changeMyDay = (command: MyDayCommand) =>
    act<MyDayChange>({ myDay: myDayDate, command }, async (requestId) =>
      myDayDate ? client.myDay.change(myDayDate, command, dashed(requestId)) : { ok: false, message: null, status: 0 },
    );
  const makeTask = async (item: DeskItem) => {
    if (!item.todoFingerprint || isInFlight()) return;
    const result = await changeMyDay({ op: "todo", key: item.key, fingerprint: item.todoFingerprint });
    if (result.ok) onTask?.(item.title);
  };
  const perform = () => {
    if (!enter || isInFlight()) return;
    return "myDay" in enter ? changeMyDay(enter.myDay) : act({ mail: enter.mail }, () => client.mail.send(enter.mail));
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
  const offersTask = (item: DeskItem) => canMakeTask(item) && !!myDayDate;
  return { busy, error, act, perform, makeTask, offersTask };
}

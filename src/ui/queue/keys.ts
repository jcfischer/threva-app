import type { MailSweep, TodayTask } from "../api/types";
import type { TextKey } from "../i18n/catalog";
import type { Entry } from "./order";

export interface EnterAct {
  label: TextKey;
  path: string;
  body: Record<string, unknown>;
}

export interface KeyMap {
  enter: EnterAct | null;
  esc: { kind: "skip" | "dismiss"; label: TextKey };
}

export function taskDone(task: TodayTask): EnterAct {
  return { label: "card.task.done", path: "/api/desk/my-day", body: { op: "done", id: task.task.id } };
}

export function sweepLetGo(sweep: MailSweep): EnterAct {
  return { label: "card.sweep.letGo", path: "/api/desk/mail", body: { action: "sweep", sweep: sweep.id, keys: sweep.mails.map((m) => m.key), target: sweep.target } };
}

export function keyMap(front: Entry | undefined): KeyMap | null {
  if (!front) return null;
  return {
    enter: front.type === "task" ? taskDone(front.task) : front.type === "sweep" ? sweepLetGo(front.sweep) : null,
    esc: front.type === "after" ? { kind: "dismiss", label: "meeting.after.nothing" } : { kind: "skip", label: "queue.skip" },
  };
}

export function allowsCardKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const target = event.target;
  if (!(target instanceof Element)) return true;
  if ((target instanceof HTMLElement && target.isContentEditable) || target.closest("input, textarea, select, [role=textbox]")) return false;
  return event.key !== "Enter" || !target.closest("button, a[href], [role=button]");
}

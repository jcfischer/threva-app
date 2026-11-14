import type { DeskClient } from "../api/client";
import type { MyDayOutline, OutlineRow } from "../api/types";
import { detailsOf } from "./note";

export const TITLE_LIMIT = 300;

const marks = /^\s*(?:>\s*|#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)/;

/** The first line of the selection with text, without its leading list, heading or quote marks, cut to 300 characters. */
export function liftTitle(selection: string): string {
  for (const line of selection.split(/\r?\n/)) {
    let text = line;
    while (marks.test(text)) text = text.replace(marks, "");
    text = text.replace(/^\s*[-*+>#]+\s*$/, "").trim();
    if (text) return Array.from(text).slice(0, TITLE_LIMIT).join("").trim();
  }
  return "";
}

/** The page without the selected range; a run of more than one empty line left where it was is closed. */
export function withoutSelection(page: string, from: number, to: number): string {
  const before = page.slice(0, from);
  const after = page.slice(to);
  const left = /[ \t\n]*$/.exec(before)![0];
  const right = /^[ \t\n]*/.exec(after)![0];
  const head = before.slice(0, before.length - left.length);
  const tail = after.slice(right.length);
  const gap = left + right;
  const lines = gap.split("\n").length - 1;
  if (!head) return tail;
  if (!tail) return lines > 0 ? head + "\n" : head;
  return head + (lines > 2 ? "\n\n" : gap) + tail;
}

export interface LiftRequest {
  client: Pick<DeskClient, "changeOutline">;
  date: string;
  revision: number;
  parent: OutlineRow;
  page: string;
  from: number;
  to: number;
  fallback: string;
}

export type LiftOutcome =
  | { state: "empty" }
  | { state: "refused"; message: string }
  | { state: "lifted"; title: string; page: string; view: MyDayOutline }
  | { state: "kept"; title: string; page: string; message: string; view: MyDayOutline };

/** Adds the selection as a task row inside the opened row, then saves the page without it. Nothing is rolled back. */
export async function liftSelection({ client, date, revision, parent, page, from, to, fallback }: LiftRequest): Promise<LiftOutcome> {
  const title = liftTitle(page.slice(from, to));
  if (!title) return { state: "empty" };
  const added = await client.changeOutline(date, { op: "outline-add", revision, parent: parent.id, title, kind: "task" });
  if (!added.ok) return { state: "refused", message: added.message ?? fallback };
  const next = withoutSelection(page, from, to);
  const saved = await client.changeOutline(date, { op: "outline-edit", revision: added.data.view.revision, id: parent.id, details: detailsOf(parent, date, next), yes: false });
  if (saved.ok) return { state: "lifted", title, page: next, view: saved.data.view };
  return { state: "kept", title, page: next, message: saved.message ?? fallback, view: added.data.view };
}

import type { OutlineRow } from "../api/types";

export function pathTo(root: OutlineRow, id: string): OutlineRow[] | null {
  if (root.id === id) return [root];
  for (const child of root.children) {
    const path = pathTo(child, id);
    if (path) return [root, ...path];
  }
  return null;
}

export interface Move { parent: string; index: number }

/** Index is in the destination after removing the moving row, as Cortex expects. */
export function moveTo(root: OutlineRow, id: string, parentId: string, index: number): Move | null {
  const source = pathTo(root, id);
  const destination = pathTo(root, parentId)?.at(-1);
  const row = source?.at(-1);
  if (!source || source.length < 3 || !row || !destination || destination === root || destination.done || pathTo(row, parentId)) return null;
  const count = destination.children.filter(child => child.id !== id).length;
  const position = Math.max(0, Math.min(index, count));
  const currentParent = source.at(-2)!;
  if (currentParent.id === parentId && currentParent.children.findIndex(child => child.id === id) === position) return null;
  return { parent: parentId, index: position };
}

export function stepMove(root: OutlineRow, id: string, direction: "up" | "down" | "out"): Move | null {
  const path = pathTo(root, id);
  if (!path || path.length < 3) return null;
  const parent = path.at(-2)!;
  const index = parent.children.findIndex(child => child.id === id);
  if (direction === "out") {
    const grandparent = path.at(-3)!;
    return moveTo(root, id, grandparent.id, grandparent.children.findIndex(child => child.id === parent.id) + 1);
  }
  const next = index + (direction === "up" ? -1 : 1);
  if (next < 0 || next >= parent.children.length) return null;
  return moveTo(root, id, parent.id, next);
}

export function dropMove(root: OutlineRow, id: string, target: string, zone: "before" | "after" | "into"): Move | null {
  if (id === target) return null;
  const path = pathTo(root, target);
  if (!path) return null;
  const row = path.at(-1)!;
  if (zone === "into") return moveTo(root, id, target, row.children.length);
  const parent = path.at(-2);
  if (!parent) return null;
  const siblings = parent.children.filter(child => child.id !== id);
  return moveTo(root, id, parent.id, siblings.findIndex(child => child.id === target) + Number(zone === "after"));
}

export function destinations(root: OutlineRow, moving: string): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  const walk = (row: OutlineRow, labels: string[]) => {
    if (row.id === moving || row.done) return;
    const path = [...labels, row.title];
    result.push({ id: row.id, label: path.join(" › ") });
    row.children.forEach(child => walk(child, path));
  };
  root.children.forEach(area => walk(area, []));
  return result;
}

import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "../src/ui/api/client";
import type { MyDayOutline, OutlineCommand } from "../src/ui/api/types";
import { App } from "../src/ui/app";
import { pathTo } from "../src/ui/everything/moves";
import { EverythingView } from "../src/ui/everything/view";
import { DATE, outlineFixture, row } from "./fixtures/outline";

async function surface(run: (container: HTMLDivElement, render: (element: React.ReactNode) => Promise<void>) => Promise<void>) {
  const dom = new Window();
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try { await run(container, async element => { await act(async () => root.render(element)); }); }
  finally {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

const click = async (container: Element, text: string) => {
  const button = Array.from(container.querySelectorAll("button")).find(el => el.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
};

const input = async (container: Element, value: string) => {
  const field = container.querySelector("input")!;
  await act(async () => {
    // Bypass React's value tracker to exercise the input event path.
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
};

function memoryClient(seed: MyDayOutline = outlineFixture()) {
  let saved = seed;
  const commands: OutlineCommand[] = [];
  const client = createClient(async (_url, init) => {
    if (!init) return Response.json(saved);
    const body = JSON.parse(init.body as string) as { date: string; command: OutlineCommand };
    expect(body.date).toBe(DATE);
    expect(body.command.revision).toBe(saved.revision);
    commands.push(body.command);
    const command = body.command;
    if (command.op === "outline-add") pathTo(saved.outline, command.parent)!.at(-1)!.children.push(row("new", { title: command.title }));
    else if (command.op === "outline-move") {
      const path = pathTo(saved.outline, command.id)!;
      const parent = path.at(-2)!;
      const moving = path.at(-1)!;
      parent.children = parent.children.filter(child => child.id !== command.id);
      pathTo(saved.outline, command.parent)!.at(-1)!.children.splice(command.index, 0, moving);
    } else {
      const node = pathTo(saved.outline, command.id)!.at(-1)!;
      node.done = command.op === "outline-complete";
      node.completedAt = node.done ? DATE : undefined;
    }
    saved = { ...saved, revision: saved.revision + 1 };
    return Response.json({ view: saved });
  });
  return { client, commands };
}

test("drill-in frames, grey rows in order, folded Done, importance and weekly share", async () => surface(async (container, render) => {
  await render(<EverythingView client={createClient()} initialDay={outlineFixture()} shares={[{ areaId: "area:work", actualShare: 0.58, targetShare: 0.45 }]} />);
  await click(container, "Work");
  expect(container.querySelectorAll(".anc")).toHaveLength(1);
  expect(container.textContent).toContain("Importance: 45");
  expect(container.textContent).toContain("58% of your time this week. The mark is the 45% you want.");
  expect(container.querySelector(".balbar i")?.getAttribute("style")).toContain("58%");
  await click(container, "Exercise");
  expect(container.querySelectorAll(".anc")).toHaveLength(2);
  expect(Array.from(container.querySelectorAll(".cur>.vrow,.cur>div>.vrow")).map(el => el.getAttribute("data-row"))).toEqual(["due", "away", "plain", "starts", "late", "weekly"]);
  for (const id of ["away", "starts", "weekly"]) expect(container.querySelector(`[data-row="${id}"]`)?.classList.contains("outline-grey")).toBe(true);
  expect(container.querySelector('[data-row="late"] .outline-warning')?.textContent).toBe("was due last Wed");
  expect(container.querySelector('[data-row="weekly"] .outline-margin')?.textContent).toBe("done last Thu · back Wed · every week");
  expect(container.querySelector(".outline-done")?.hasAttribute("open")).toBe(false);
  expect(container.querySelector(".outline-done summary")?.textContent).toBe("Done · 1");
  expect(container.querySelector('.outline-done [data-row="done"]')).not.toBeNull();
  await click(container, "‹ Work");
  expect(container.querySelector("h2")?.textContent).toBe("Work");
  await click(container, "‹ Outline");
  expect(container.querySelector("h2")?.textContent).toBe("Outline");
}));

test("add, menu moves, finish and reopen use each returned revision; drafts stay with their parent", async () => surface(async (container, render) => {
  const { client, commands } = memoryClient();
  await render(<EverythingView client={client} initialDay={outlineFixture()} />);
  await click(container, "Work");
  await click(container, "Exercise");
  await input(container, "A new task");
  await click(container, "‹ Work");
  await input(container, "Area draft");
  await click(container, "Exercise");
  expect(container.querySelector("input")?.value).toBe("A new task");
  await click(container, "Add");
  expect(commands[0]).toEqual({ op: "outline-add", parent: "project", title: "A new task", revision: 12 });
  expect(container.querySelector("input")?.value).toBe("");
  let added = container.querySelector('[data-row="new"]')!;
  await click(added, "Up");
  expect(commands[1]).toEqual({ op: "outline-move", id: "new", parent: "project", index: 6, revision: 13 });
  added = container.querySelector('[data-row="new"]')!;
  await click(added, "Done");
  expect(commands[2]).toEqual({ op: "outline-complete", id: "new", confirm: true, revision: 14 });
  expect(container.querySelector(".outline-done summary")?.textContent).toBe("Done · 2");
  expect(container.querySelector('.outline-done [data-row="new"]')).not.toBeNull();
  await click(container.querySelector('[data-row="new"]')!, "Reopen");
  expect(commands[3]).toEqual({ op: "outline-reopen", id: "new", confirm: true, revision: 15 });
  expect(container.querySelector('.outline-done [data-row="new"]')).toBeNull();
  await click(container.querySelector('[data-row="new"]')!, "Down");
  expect(commands[4]).toMatchObject({ op: "outline-move", index: 7, revision: 16 });
  await click(container.querySelector('[data-row="new"]')!, "Out");
  expect(commands[5]).toMatchObject({ op: "outline-move", parent: "area:work", index: 1, revision: 17 });
  await click(container, "‹ Work");
  expect(container.querySelector("input")?.value).toBe("Area draft");
  const select = container.querySelector<HTMLSelectElement>('[data-row="new"] select')!;
  await act(async () => { select.value = "area:me"; select.dispatchEvent(new window.Event("change", { bubbles: true })); });
  expect(commands[6]).toMatchObject({ op: "outline-move", parent: "area:me", index: 0, revision: 18 });
}));

test("Cortex refusal is shown verbatim, reloads the outline, and keeps typed text", async () => surface(async (container, render) => {
  let reads = 0;
  let writes = 0;
  const latest = outlineFixture(); latest.revision = 99;
  latest.outline.children[0]!.title = "Work from another window";
  const client = createClient(async (_url, init) => {
    if (init) { writes++; return Response.json({ error: "Cortex refused this stale outline." }, { status: 409 }); }
    reads++; return Response.json(latest);
  });
  await render(<EverythingView client={client} initialDay={outlineFixture()} />);
  await click(container, "Work");
  await input(container, "Keep this draft");
  await click(container, "Add");
  expect(reads).toBe(1); expect(writes).toBe(1);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Cortex refused this stale outline.");
  expect(container.querySelector("h2")?.textContent).toBe("Work from another window");
  expect(container.querySelector("input")?.value).toBe("Keep this draft");
}));

test("a row with children can be finished and reopened both in the outline and on its page", async () => surface(async (container, render) => {
  const { client, commands } = memoryClient();
  await render(<EverythingView client={client} initialDay={outlineFixture()} />);
  await click(container, "Work");
  await click(container.querySelector('[data-row="project"]')!, "Done");
  expect(container.querySelector('.outline-done [data-row="project"]')).not.toBeNull();
  await click(container.querySelector('[data-row="project"]')!, "Reopen");
  expect(container.querySelector('.outline-done [data-row="project"]')).toBeNull();
  await click(container, "Exercise");
  const pageAction = () => Array.from(container.querySelectorAll<HTMLButtonElement>(".cur>button")).at(-1)!;
  await act(async () => pageAction().click());
  expect(pageAction().textContent).toBe("Reopen");
  await act(async () => pageAction().click());
  expect(pageAction().textContent).toBe("Done");
  expect(commands.map(command => command.op)).toEqual(["outline-complete", "outline-reopen", "outline-complete", "outline-reopen"]);
  expect(commands.every(command => "id" in command && command.id === "project")).toBe(true);
}));

test("drag moves send the source snapshot's revision and drop index", async () => surface(async (container, render) => {
  const { client, commands } = memoryClient();
  await render(<EverythingView client={client} initialDay={outlineFixture()} />);
  await click(container, "Work"); await click(container, "Exercise");
  const moving = container.querySelector('[data-row="plain"]')!;
  const target = container.querySelector('[data-row="due"]')!;
  await act(async () => {
    const start = new window.Event("dragstart", { bubbles: true });
    Object.defineProperty(start, "dataTransfer", { value: { setData() {} } });
    moving.dispatchEvent(start);
  });
  await act(async () => {
    const drop = new window.Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "clientY", { value: 0 });
    target.dispatchEvent(drop);
  });
  expect(commands).toEqual([{ op: "outline-move", id: "plain", parent: "project", index: 0, revision: 12 }]);
}));

test("App switches above the card and keeps the outline draft across Day", async () => surface(async (container, render) => {
  const fixture = outlineFixture();
  const client = createClient(async url => Response.json(url === "/api/desk/my-day" ? fixture : url === "/api/desk/studio" ? { studio: null } : url === "/api/desk/mail/rules" ? { rules: [] } : { generatedAt: Date.now(), displayName: null, today: [], items: [] }));
  await render(<App client={client} />);
  expect(container.querySelector(".view-switch")!.compareDocumentPosition(container.querySelector(".cards")!) & 4).toBe(4);
  await click(container, "Everything");
  await click(container, "Work");
  await input(container.querySelector(".everything")!, "Still here");
  await click(container, "Day");
  expect(container.querySelector(".everything")?.parentElement?.hidden).toBe(true);
  await click(container, "Everything");
  expect(container.querySelector(".everything input")?.getAttribute("value")).toBe("Still here");
}));

import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "../src/ui/api/client";
import { QueueContext } from "../src/ui/cards/act";
import { MailCard } from "../src/ui/cards/mail-cards";
import { item } from "./fixtures/desk";

test("a failed attach lookup can be cancelled without another request", async () => {
  const dom = new Window();
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const writes: unknown[] = [];
  const client = createClient(async (_url, init) => {
    writes.push(JSON.parse(init!.body as string));
    return Response.json({ error: "Lookup unavailable." }, { status: 503 });
  });
  try {
    await act(async () => {
      root.render(
        <QueueContext.Provider value={{ client, refresh: () => {} }}>
          <MailCard item={item({ key: "mail:1", kind: "mail" })} />
        </QueueContext.Provider>,
      );
    });
    const attach = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Attach")!;
    await act(async () => { attach.click(); });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Lookup unavailable.");
    const cancel = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Cancel");
    expect(cancel).toBeDefined();
    await act(async () => { cancel!.click(); });
    expect(container.querySelector(".ivy")).toBeNull();
    expect(attach.getAttribute("aria-pressed")).toBe("false");
    expect(writes).toEqual([{ action: "studio.propose", key: "mail:1" }]);
  } finally {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

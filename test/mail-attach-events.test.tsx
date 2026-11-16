import { expect, test } from "bun:test";
import { act } from "react";
import { createMemoryClient } from "../src/ui/api/memory-client";
import { QueueContext } from "../src/ui/cards/act";
import { MailCard } from "../src/ui/cards/mail-cards";
import { item } from "./fixtures/desk";
import { mountDom } from "./fixtures/dom";

test("a failed attach lookup can be cancelled without another request", async () => {
  const { root, container, cleanup } = mountDom();
  const client = createMemoryClient();
  client.seed("mail.send", { ok: false, message: "Lookup unavailable.", status: 503 });
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
    expect(client.calls.map((c) => [c.name, c.args])).toEqual([["mail.send", [{ action: "studio.propose", key: "mail:1" }]]]);
  } finally {
    await cleanup();
  }
});

test("attaching sends the thread and the reason through studioAdd, and a failed attach retries with the same request id", async () => {
  const { root, container, cleanup } = mountDom();
  const client = createMemoryClient();
  const proposal = { thread: "budget", reason: " It fits. ", threads: [{ slug: "budget", question: "Budget?" }] };
  client.seed("mail.send", { ok: true, data: { proposal } });
  client.seed("mail.studioAdd", { ok: false, message: null, status: 0 });
  const click = (text: string) => act(async () => { Array.from(container.querySelectorAll("button")).filter((b) => b.textContent === text).at(-1)!.click(); });
  try {
    await act(async () => {
      root.render(
        <QueueContext.Provider value={{ client, refresh: () => {} }}>
          <MailCard item={item({ key: "mail:1", kind: "mail" })} />
        </QueueContext.Provider>,
      );
    });
    await click("Attach");
    await click("Attach");
    await click("Attach");
    const adds = client.calls.filter((c) => c.name === "mail.studioAdd").map((c) => c.args);
    expect(adds).toHaveLength(2);
    expect(adds[0]).toEqual(["mail:1", "budget", "It fits.", expect.any(String)]);
    expect(adds[1][3]).toBe(adds[0][3]);
  } finally {
    await cleanup();
  }
});

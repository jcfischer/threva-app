import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { QueueContext, useAct } from "../src/ui/cards/act";
import { createMemoryClient, type MemoryClient } from "../src/ui/api/memory-client";
import { mountDom, type MountedDom } from "./fixtures/dom";

let dom: MountedDom;
let client: MemoryClient;
let hook: ReturnType<typeof useAct>;

function Harness() {
  hook = useAct({ label: "card.task.done", myDay: { op: "done", id: "t1" } } as never);
  return null;
}

beforeEach(async () => {
  dom = mountDom();
  client = createMemoryClient();
  await act(async () => dom.root.render(<QueueContext.Provider value={{ client, refresh: () => {}, myDayDate: "2026-11-16" }}><Harness /></QueueContext.Provider>));
});
afterEach(async () => {
  await dom.cleanup();
});

describe("useAct", () => {
  test("sends the retained request id to My Day on retry", async () => {
    client.seed("myDay.change", { ok: false, message: "no", status: 503 });
    await act(async () => { await hook.perform(); });
    await act(async () => { await hook.perform(); });
    const ids = client.calls.filter((c) => c.name === "myDay.change").map((c) => c.args[2]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBeString();
    expect(ids[1]).toBe(ids[0]);
  });

  test("sends the retained request id to the ruling call on retry", async () => {
    client.seed("queue.ruling", { ok: false, message: "no", status: 0 });
    const send = async () => { await hook.act({ ruling: "k" }, (requestId) => client.queue.ruling("k", "text", requestId)); };
    await act(send);
    await act(send);
    const ids = client.calls.filter((c) => c.name === "queue.ruling").map((c) => c.args[2]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBeString();
    expect(ids[1]).toBe(ids[0]);
  });
});

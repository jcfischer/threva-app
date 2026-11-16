import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { useDeskAct } from "../src/ui/act/use-act";
import type { Result } from "@desk/client";
import { createMemoryClient, type MemoryClient } from "@desk/memory-client";
import type { StudioAct } from "@desk/types";
import { mountDom, type MountedDom } from "./fixtures/dom";

let dom: MountedDom;
let client: MemoryClient;
let refreshed: number;
let hook: ReturnType<typeof useDeskAct>;

function Harness() {
  hook = useDeskAct(() => {
    refreshed++;
  });
  return null;
}

const park = { type: "park", slug: "a" } as unknown as StudioAct;
const finish = { type: "finish", slug: "b" } as unknown as StudioAct;
const send = (studio: StudioAct) => hook.act(studio, (id) => client.studio.act(studio, id));
const fire = async (studio: StudioAct) => {
  let result!: Result<unknown>;
  await act(async () => {
    result = await send(studio);
  });
  return result;
};
const ids = () => client.calls.filter((call) => call.name === "studio.act").map((call) => call.args[1]);

beforeEach(async () => {
  dom = mountDom();
  client = createMemoryClient();
  refreshed = 0;
  await act(async () => dom.root.render(<Harness />));
});
afterEach(async () => {
  await dom.cleanup();
});

describe("useDeskAct", () => {
  test.each([0, 500, 503])("reuses the request id after status %d", async (status) => {
    client.seed("studio.act", { ok: false, message: "no", status });
    await fire(park);
    await fire(park);
    const [first, second] = ids();
    expect(first).toBeString();
    expect(second).toBe(first);
  });

  test.each([400, 409])("uses a new request id after a %d", async (status) => {
    client.seed("studio.act", { ok: false, message: "no", status });
    await fire(park);
    await fire(park);
    const [first, second] = ids();
    expect(second).not.toBe(first);
  });

  test("uses a new request id after success", async () => {
    client.seed("studio.act", { ok: true, data: {} });
    await fire(park);
    await fire(park);
    const [first, second] = ids();
    expect(second).not.toBe(first);
  });

  test("uses a new request id for a different act after a possible write", async () => {
    client.seed("studio.act", { ok: false, message: null, status: 0 });
    await fire(park);
    await fire(finish);
    const [first, second] = ids();
    expect(second).not.toBe(first);
  });

  test("does not send a second act while one is in flight", async () => {
    let release!: () => void;
    client.seed("studio.act", () => ({ ok: true, data: {} }));
    await act(async () => {
      const gate = new Promise<void>((resolve) => (release = resolve));
      const first = hook.act(park, async (id) => {
        await gate;
        return client.studio.act(park, id);
      });
      const second = await send(finish);
      expect(second.ok).toBe(false);
      release();
      await first;
    });
    expect(ids()).toHaveLength(1);
  });

  test("refreshes once on success", async () => {
    client.seed("studio.act", { ok: true, data: {} });
    await fire(park);
    expect(refreshed).toBe(1);
    expect(hook.error).toBeNull();
  });

  test("exposes the message and skips refresh on failure", async () => {
    client.seed("studio.act", { ok: false, message: "Not allowed", status: 403 });
    await fire(park);
    expect(refreshed).toBe(0);
    expect(hook.error).toEqual({ message: "Not allowed" });
  });
});

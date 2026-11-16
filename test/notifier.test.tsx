import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { App } from "../src/ui/app";
import { createMemoryClient } from "@desk/memory-client";
import type { DeskItem } from "@desk/types";
import { NotifyControl } from "../src/ui/day/notify-control";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { browserNotifier, interruptionWatcher, type Notifier, type NotifyPermission } from "../src/ui/queue/notifier";
import { POLL_MS } from "../src/ui/queue/use-desk";
import { item, view } from "./fixtures/desk";
import { mountDom, type MountedDom } from "./fixtures/dom";

const urgent = (key: string, delivery: "pending" | "held" = "pending") => item({ key, kind: "mail", title: `Mail ${key}`, why: "From a VIP.", interrupt: { delivery, reason: { code: "mail.vip", target: "ada@example.org" } } });

function fakeNotifier() {
  let permission: NotifyPermission = "granted";
  let hidden = true;
  let focused = 0;
  let requested = 0;
  const notifications: { key: string; title: string; why: string; click: () => void }[] = [];
  const notifier: Notifier = {
    permission: () => permission,
    requestPermission: async () => { requested++; permission = "granted"; return permission; },
    hidden: () => hidden,
    focus: () => { focused++; },
    notify: (item, click) => { notifications.push({ ...item, click }); },
  };
  return { notifier, notifications, permission: (value: NotifyPermission) => { permission = value; }, hidden: (value: boolean) => { hidden = value; }, focused: () => focused, requested: () => requested };
}

describe("interruption notifications", () => {
  test("first load is quiet; later hidden arrivals notify once per key, with Cortex title and why", () => {
    const fake = fakeNotifier();
    const opened: string[] = [];
    const poll = interruptionWatcher(fake.notifier, key => opened.push(key));
    poll([urgent("initial")]);
    expect(fake.notifications).toHaveLength(0);
    poll([urgent("initial"), urgent("new")]);
    expect(fake.notifications.map(({ key, title, why }) => ({ key, title, why }))).toEqual([{ key: "new", title: "Mail new", why: "From a VIP." }]);
    poll([]);
    poll([urgent("new"), urgent("initial")]);
    expect(fake.notifications).toHaveLength(1);
    fake.notifications[0]!.click();
    expect(fake.focused()).toBe(1);
    expect(opened).toEqual(["new"]);
  });
  test("held items are quiet, including on first load; release can notify on a later poll", () => {
    const fake = fakeNotifier();
    const poll = interruptionWatcher(fake.notifier, () => {});
    poll([urgent("held", "held")]);
    poll([urgent("held", "held"), item({ key: "ordinary", kind: "sensor" }), item({ key: "legacy", kind: "sensor", interrupt: { delivery: "failed" } })]);
    expect(fake.notifications).toHaveLength(0);
    poll([urgent("held")]);
    expect(fake.notifications.map(n => n.key)).toEqual(["held"]);
  });
  test("a visible arrival is seen and does not notify after the tab becomes hidden", () => {
    const fake = fakeNotifier();
    const poll = interruptionWatcher(fake.notifier, () => {});
    poll([]);
    fake.hidden(false);
    poll([urgent("seen")]);
    expect(fake.notifications).toHaveLength(0);
    fake.hidden(true);
    poll([urgent("seen"), urgent("unseen")]);
    expect(fake.notifications.map(n => n.key)).toEqual(["unseen"]);
  });
  test("an ordinary item already loaded is not a new arrival when it later gains an interruption reason", () => {
    const fake = fakeNotifier();
    const poll = interruptionWatcher(fake.notifier, () => {});
    poll([item({ key: "already-loaded", kind: "mail" })]);
    poll([urgent("already-loaded"), urgent("new")]);
    expect(fake.notifications.map(n => n.key)).toEqual(["new"]);
  });
  for (const permission of ["default", "denied", "unavailable"] as const) test(`no notification or automatic permission request when ${permission}`, () => {
    const fake = fakeNotifier();
    fake.permission(permission);
    const poll = interruptionWatcher(fake.notifier, () => {});
    poll([]);
    poll([urgent("new")]);
    expect(fake.notifications).toHaveLength(0);
    expect(fake.requested()).toBe(0);
    fake.permission("granted");
    poll([urgent("new"), urgent("later")]);
    expect(fake.notifications.map(n => n.key)).toEqual(["later"]);
  });
  test("a browser constructor refusal does not break polling", () => {
    const fake = fakeNotifier();
    fake.notifier.notify = () => { throw new Error("Use a service worker"); };
    const poll = interruptionWatcher(fake.notifier, () => {});
    poll([]);
    expect(() => poll([urgent("new")])).not.toThrow();
  });
});

describe("notification permission in the day view", () => {
  let dom: MountedDom;
  beforeEach(() => { dom = mountDom(); });
  afterEach(async () => { await dom.cleanup(); });
  const mount = async (notifier: Notifier, locale: "en" | "de" = "en") => {
    await act(async () => dom.root.render(<I18nProvider value={createI18n(locale)}><NotifyControl key={locale + notifier.permission()} notifier={notifier} /></I18nProvider>));
  };
  test("one quiet control asks only on click and disappears after granting permission", async () => {
    const fake = fakeNotifier();
    fake.permission("default");
    await mount(fake.notifier);
    expect(dom.container.querySelectorAll("button")).toHaveLength(1);
    expect(dom.container.querySelector("button")?.className).toBe("btn quiet");
    expect(dom.container.textContent).toBe("Notify me when something can't wait");
    expect(fake.requested()).toBe(0);
    await act(async () => { dom.container.querySelector("button")!.click(); });
    expect(fake.requested()).toBe(1);
    expect(dom.container.querySelector("button")).toBeNull();
  });
  test("German control; granted, denied and unavailable offer nothing", async () => {
    const fake = fakeNotifier();
    fake.permission("default");
    await mount(fake.notifier, "de");
    expect(dom.container.textContent).toBe("Benachrichtige mich, wenn etwas nicht warten kann");
    for (const permission of ["granted", "denied", "unavailable"] as const) {
      fake.permission(permission);
      await mount(fake.notifier);
      expect(dom.container.querySelector("button")).toBeNull();
    }
  });
  test("the browser adapter tolerates a missing API and a refused permission request", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "Notification");
    try {
      Object.defineProperty(window, "Notification", { configurable: true, value: undefined });
      const notifier = browserNotifier();
      expect(notifier.permission()).toBe("unavailable");
      expect(await notifier.requestPermission()).toBe("unavailable");
      await mount(notifier);
      expect(dom.container.textContent).toBe("");
      Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "default", requestPermission: async () => { throw new Error("Refused"); } } });
      expect(await notifier.requestPermission()).toBe("default");
    } finally {
      if (descriptor) Object.defineProperty(window, "Notification", descriptor);
      else Reflect.deleteProperty(window, "Notification");
    }
  });
});

test("App polls, notifies, and a notification click returns to Day with that card first", async () => {
  const dom = mountDom();
  const originalInterval = globalThis.setInterval;
  const originalClear = globalThis.clearInterval;
  let tick: (() => void) | undefined;
  const fake = fakeNotifier();
  let items: DeskItem[] = [urgent("initial")];
  const client = createMemoryClient();
  client.seed("desk", () => ({ ok: true, data: view({ items }) }));
  client.seed("studio", { ok: true, data: { studio: null } });
  client.seed("rules", { ok: true, data: { rules: [] } });
  client.seed("myDay", { ok: true, data: { date: "2026-11-14", revision: 1, outline: { id: "root", title: "Everything", ordering: "parallel", weight: 1, children: [] } } });
  // Drive the actual polling callback without waiting fifteen seconds in a test.
  globalThis.setInterval = ((callback: () => void, delay: number) => {
    if (delay === POLL_MS) tick = callback;
    return originalInterval(callback, 1_000_000);
  }) as typeof setInterval;
  try {
    await act(async () => dom.root.render(<App client={client} notifier={fake.notifier} />));
    expect(fake.notifications).toHaveLength(0);
    const everything = Array.from(dom.container.querySelectorAll("button")).find(b => b.textContent === "Everything")!;
    await act(async () => { everything.click(); });
    items = [urgent("initial"), urgent("new"), urgent("last")];
    await act(async () => { tick!(); });
    expect(fake.notifications.map(n => n.key)).toEqual(["new", "last"]);
    await act(async () => { fake.notifications[1]!.click(); });
    expect(fake.focused()).toBe(1);
    expect(dom.container.querySelector('.view-switch [aria-pressed="true"]')?.textContent).toBe("Day");
    expect(dom.container.querySelector(".cards .card .q")?.textContent).toBe("Mail last");
    await act(async () => { tick!(); });
    expect(fake.notifications).toHaveLength(2);
  } finally {
    await dom.cleanup();
    globalThis.setInterval = originalInterval;
    globalThis.clearInterval = originalClear;
  }
});

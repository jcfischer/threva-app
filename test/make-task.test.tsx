import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, type ReactNode } from "react";
import { DayView } from "../src/ui/app";
import { createMemoryClient, type MemoryClient } from "@desk/memory-client";
import type { Result } from "@desk/client";
import type { DeskItem } from "@desk/types";
import { QueueContext } from "../src/ui/cards/act";
import { MailCard } from "../src/ui/cards/mail-cards";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { EntryCard } from "../src/ui/queue/queue-view";
import { EMPTY_SESSION } from "../src/ui/queue/order";
import { DAY, item, NOW, view } from "./fixtures/desk";
import { mountDom, type MountedDom } from "./fixtures/dom";

const FINGERPRINT = "a".repeat(64);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const mail = (overrides: Partial<DeskItem> = {}) => item({ key: "mail:1", kind: "mail", title: "Workshop dates", todoFingerprint: FINGERPRINT, ...overrides });
const sensor = (overrides: Partial<DeskItem> = {}) => item({ key: "sensor:1", kind: "sensor", title: "Disk almost full", todoFingerprint: FINGERPRINT, ...overrides });

let dom: MountedDom;
let client: MemoryClient;
let reply: () => Result<unknown>;
let added: string[];
let refreshed: number;

beforeEach(() => {
  dom = mountDom();
  client = createMemoryClient();
  client.seed("myDay.change", () => reply());
  added = [];
  refreshed = 0;
  reply = () => ({ ok: true, data: { view: {} } });
});
afterEach(async () => {
  await dom.cleanup();
});

async function mount(node: ReactNode, { locale = "en", date = DAY }: { locale?: "en" | "de"; date?: string } = {}) {
  await act(async () => {
    dom.root.render(
      <I18nProvider value={createI18n(locale)}>
        <QueueContext.Provider value={{ client, refresh: () => { refreshed += 1; }, ...(date ? { myDayDate: date } : {}), onTask: (title) => added.push(title) }}>
          {node}
        </QueueContext.Provider>
      </I18nProvider>,
    );
  });
}

const buttons = () => Array.from(dom.container.querySelectorAll("button")).map((b) => b.textContent);
const button = (text: string) => Array.from(dom.container.querySelectorAll("button")).find((b) => b.textContent === text)!;
const click = (text: string) => act(async () => { button(text).click(); });
const todo = (key: string) => ({ name: "myDay.change", args: [DAY, { op: "todo", key, fingerprint: FINGERPRINT }, expect.stringMatching(UUID)] });

describe("Make it a task on a mail card", () => {
  test("sits with the outcomes, not under Ask me, and is Als Aufgabe in German", async () => {
    await mount(<MailCard item={mail()} />);
    const outcomes = dom.container.querySelector('[role="group"]')!;
    expect(Array.from(outcomes.querySelectorAll("button")).map((b) => b.textContent)).toContain("Make it a task");
    await click("Ask me");
    expect(buttons().filter((b) => b === "Make it a task")).toHaveLength(1);
    expect(buttons()).not.toContain("Keep as a task");
    expect(buttons()).toContain("Snooze");

    await mount(<MailCard item={mail()} />, { locale: "de" });
    expect(buttons()).toContain("Als Aufgabe");
  });

  test("one click sends the todo command in Cortex's envelope and tells the queue", async () => {
    await mount(<MailCard item={mail()} />);
    await click("Make it a task");
    expect(client.calls).toEqual([todo("mail:1")]);
    expect(added).toEqual(["Workshop dates"]);
    expect(refreshed).toBe(1);
  });

  test("a refusal keeps the card and shows Cortex's error as it came", async () => {
    reply = () => ({ ok: false, message: "The source changed since you opened it. Refresh before moving it to your Inbox.", status: 409 });
    await mount(<MailCard item={mail()} />);
    await click("Make it a task");
    expect(dom.container.querySelector('[role="alert"]')?.textContent).toBe("The source changed since you opened it. Refresh before moving it to your Inbox.");
    expect(buttons()).toContain("Make it a task");
    expect(added).toEqual([]);
    expect(refreshed).toBe(0);
  });

  test("is not offered without a fingerprint, on a read-only item, or without the My Day date", async () => {
    await mount(<MailCard item={mail({ todoFingerprint: undefined })} />);
    expect(buttons()).not.toContain("Make it a task");
    await mount(<MailCard item={mail({ readOnly: true })} />);
    expect(buttons()).not.toContain("Make it a task");
    await mount(<MailCard item={mail()} />, { date: "" });
    expect(buttons()).not.toContain("Make it a task");
  });
});

describe("Make it a task on other cards", () => {
  test("an item card offers it next to its links and sends the same envelope", async () => {
    await mount(<EntryCard entry={{ k: "i:sensor:1", type: "item", item: sensor({ actions: [{ id: "open", label: "Open", role: "primary", wired: true, url: "https://example.com/" }] }), fresh: false }} onDismissMeeting={() => {}} />);
    expect(buttons()).toEqual(["Make it a task"]);
    await click("Make it a task");
    expect(client.calls).toEqual([todo("sensor:1")]);
    expect(added).toEqual(["Disk almost full"]);
  });

  test("an agent card offers it beside its actions", async () => {
    await mount(<EntryCard entry={{ k: "i:agent:1", type: "agent", item: sensor({ key: "agent:1", kind: "decision" }) }} onDismissMeeting={() => {}} />);
    await click("Make it a task");
    expect(client.calls).toEqual([todo("agent:1")]);
  });

  test("an item card shows Cortex's refusal", async () => {
    reply = () => ({ ok: false, message: "This source item is no longer on the Desk.", status: 409 });
    await mount(<EntryCard entry={{ k: "i:sensor:1", type: "item", item: sensor(), fresh: false }} onDismissMeeting={() => {}} />);
    await click("Make it a task");
    expect(dom.container.querySelector('[role="alert"]')?.textContent).toBe("This source item is no longer on the Desk.");
    expect(added).toEqual([]);
  });
});

describe("the queue after a card became a task", () => {
  const show = (items: DeskItem[]) =>
    act(async () => {
      dom.root.render(
        <I18nProvider value={createI18n("en")}>
          <DayView client={client} state={{ view: view({ items, myDay: { date: DAY, items: [] } }), studio: null, error: null, refresh: () => {} }} session={EMPTY_SESSION} setSession={() => {}} now={NOW} />
        </I18nProvider>,
      );
    });
  const line = () => dom.container.querySelector('.toast[role="status"]');
  const next = sensor({ key: "sensor:1" });
  const later = sensor({ key: "sensor:2", title: "Backup failed" });

  test("says where the task went, with no Undo, while the next card is in front", async () => {
    await show([mail(), next, later]);
    await click("Make it a task");
    expect(client.calls).toEqual([todo("mail:1")]);
    expect(line()?.textContent).toBe("Added “Workshop dates” to today's Inbox.");
    expect(line()?.querySelector("button")).toBeNull();

    await show([next, later]);
    expect(line()?.textContent).toBe("Added “Workshop dates” to today's Inbox.");
    await show([later]);
    expect(line()).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { type Root } from "react-dom/client";
import { createMemoryClient, type MemoryClient } from "../src/ui/api/memory-client";
import type { DeskAction, DeskItem } from "../src/ui/api/types";
import { QueueContext } from "../src/ui/cards/act";
import { AgentCard } from "../src/ui/cards/queue-cards";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { item } from "./fixtures/desk";
import { mountDom } from "./fixtures/dom";

const ISSUE = "https://github.com/the-metafactory/cortex/issues/3475";
const action = (id: string, label: string, role: DeskAction["role"], wired: boolean): DeskAction => ({ id, label, role, wired });
const DETAIL = action("detail", "Look first", "secondary", true);
const SNOOZE = action("snooze", "Not now", "secondary", true);

// Shapes as Cortex v6.29.0 sends them on /api/desk.
const blocked = (overrides: Partial<DeskItem> = {}) =>
  item({
    key: "ranger:the-metafactory/cortex#3475",
    kind: "agent-blocked",
    source: "ranger",
    title: '"Desk: the agent card" waits for your ruling.',
    why: "The agent in cortex cannot go on without a decision from you.",
    actions: [action("ranger.rule", "Give your ruling", "primary", true), DETAIL, SNOOZE],
    detail: { summary: "blocked: which store?", history: ["Stopped 2 hours ago"], refs: ["the-metafactory/cortex#3475", "the-metafactory/cortex#2770"], links: [{ label: "Issue", url: ISSUE }] },
    question: { condition: null, reason: "Which store should the agent use?" },
    explanation: {
      sentence: "The agent needs a store before it can go on.",
      choices: [
        { label: "SQLite", consequence: "Simple and local.", ruling: "Use SQLite." },
        { label: "Postgres", consequence: "Needs a server.", ruling: "Use Postgres." },
      ],
    },
    ...overrides,
  });

const failed = (overrides: Partial<DeskItem> = {}) =>
  item({
    key: "ranger:the-metafactory/cortex#3500",
    kind: "agent-failed",
    source: "ranger",
    title: 'An agent failed on "Desk: mail sort".',
    why: "The question is unavailable. Open the source to see what is needed.",
    actions: [action("ranger.retry", "Let it retry", "primary", true), DETAIL, action("ranger.park", "Park it", "secondary", false)],
    detail: { summary: "failed: the build broke on a type error.", history: [], refs: ["the-metafactory/cortex#3500", "the-metafactory/cortex#3500"], links: [{ label: "Issue", url: "https://github.com/the-metafactory/cortex/issues/3500" }] },
    ...overrides,
  });

const escalation = (overrides: Partial<DeskItem> = {}) =>
  item({
    key: "vigil:task:the-metafactory/cortex#3600",
    kind: "escalation",
    source: "vigil",
    title: '"Desk: digest wording" needs you.',
    why: "Should the digest name the sender? In cortex.",
    actions: [action("detail", "Look first", "primary", true), SNOOZE],
    detail: { summary: "Should the digest name the sender?", history: [], refs: ["the-metafactory/cortex#3600"], links: [{ label: "Issue", url: "https://github.com/the-metafactory/cortex/issues/3600" }] },
    ...overrides,
  });

describe("the agent card", () => {
  let root: Root;
  let container: HTMLElement;
  let cleanup: () => Promise<void>;
  let client: MemoryClient;

  beforeEach(() => {
    ({ root, container, cleanup } = mountDom());
    client = createMemoryClient();
    client.seed("queue.ruling", { ok: true, data: {} });
    client.seed("queue.action", { ok: true, data: {} });
  });

  afterEach(async () => {
    await cleanup();
  });

  async function render(desk: DeskItem, locale: "en" | "de" = "en") {
    await act(async () => {
      root.render(
        <I18nProvider value={createI18n(locale)}>
          <QueueContext.Provider value={{ client, refresh: () => {} }}>
            <AgentCard item={desk} />
          </QueueContext.Provider>
        </I18nProvider>,
      );
    });
  }

  test("a ruling refused by Cortex shows its message and keeps the text", async () => {
    client.seed("queue.ruling", { ok: false, message: "Ruling not accepted.", status: 409 });
    await render(blocked());
    await click(button("SQLiteSimple and local."));
    await click(button("Decide and tell the agent"));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Ruling not accepted.");
    expect(container.querySelector("textarea")!.value).toBe("Use SQLite.");
  });

  test("a ruling that failed with no response is retried with the same request id", async () => {
    client.seed("queue.ruling", { ok: false, message: null, status: 0 });
    await render(blocked());
    await click(button("SQLiteSimple and local."));
    await click(button("Decide and tell the agent"));
    await click(button("Decide and tell the agent"));
    const ids = client.calls.filter((c) => c.name === "queue.ruling").map((c) => c.args[2]);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
  });

  const buttons = () => [...container.querySelectorAll("button")].map((b) => b.textContent);
  const button = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === text)!;
  const links = () => [...container.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
  const click = (el: Element) => act(async () => { (el as HTMLElement).click(); });

  test("a blocked card offers the ruling, its choices and the issue link, and no Approve", async () => {
    await render(blocked());
    expect(buttons()).toEqual(["SQLiteSimple and local.", "PostgresNeeds a server.", "Decide and tell the agent"]);
    expect(container.querySelector("textarea")).not.toBeNull();
    expect(links()).toEqual([["Issue", ISSUE]]);
    expect(container.textContent).toContain("The agent needs a store before it can go on.");
    expect(container.textContent).not.toContain("Approve");
  });

  test("picking a choice fills the ruling box, and sending it posts the ruling", async () => {
    await render(blocked());
    const choice = button("PostgresNeeds a server.");
    expect(choice.className).toBe("chip");
    await click(choice);
    expect(container.querySelector("textarea")!.value).toBe("Use Postgres.");
    expect(choice.getAttribute("aria-pressed")).toBe("true");
    await click(button("Decide and tell the agent"));
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toMatchObject({ name: "queue.ruling", args: ["ranger:the-metafactory/cortex#3475", "Use Postgres.", expect.any(String)] });
    expect(container.textContent).toContain("Sent. The agent picks it up.");
  });

  test("references other than the item's own render as a quiet line", async () => {
    await render(blocked());
    const line = [...container.querySelectorAll(".faint")].map((e) => e.textContent).find((t) => t?.startsWith("See also:"));
    expect(line).toBe("See also: the-metafactory/cortex#2770");
  });

  test("a failed card shows the failure, offers Let it retry, and has no ruling box", async () => {
    await render(failed());
    expect(container.textContent).toContain("failed: the build broke on a type error.");
    expect(container.textContent).not.toContain("The question is unavailable.");
    expect(container.querySelector("textarea")).toBeNull();
    expect(buttons()).toEqual(["Let it retry"]);
    expect(container.textContent).not.toContain("Park it");
    expect(container.textContent).not.toContain("See also:");
    await click(button("Let it retry"));
    expect(client.calls).toEqual([{ name: "queue.action", args: ["ranger.retry", "ranger:the-metafactory/cortex#3500"] }]);
  });

  test("a failed card without a wired retry offers no buttons, even if park were wired", async () => {
    await render(failed({ actions: [action("ranger.retry", "Let it retry", "primary", false), DETAIL, action("ranger.park", "Park it", "secondary", true)] }));
    expect(buttons()).toEqual([]);
  });

  test("an escalation shows its question and issue link with no ruling box or buttons", async () => {
    await render(escalation());
    expect(container.textContent).toContain("Should the digest name the sender? In cortex.");
    expect(container.querySelector("textarea")).toBeNull();
    expect(buttons()).toEqual([]);
    expect(links()).toEqual([["Issue", "https://github.com/the-metafactory/cortex/issues/3600"]]);
  });

  test("choices without a listed ruling are not offered", async () => {
    await render(blocked({ actions: [DETAIL, SNOOZE] }));
    expect(buttons()).toEqual([]);
    expect(container.querySelector("textarea")).toBeNull();
  });

  test("an unwired or unknown action gets no button, and an open action links to its URL", async () => {
    const open = { ...action("open", "Give your ruling", "primary", true), url: "https://github.com/the-metafactory/cortex/pull/1" };
    await render(blocked({ actions: [action("ranger.rule", "Give your ruling", "primary", false), action("ranger.mystery", "Mystery", "secondary", true), open] }));
    expect(buttons()).toEqual([]);
    expect(links()).toEqual([["Open the source", "https://github.com/the-metafactory/cortex/pull/1"], ["Issue", ISSUE]]);
  });

  test("unsafe links are dropped", async () => {
    await render(escalation({ detail: { summary: "", links: [{ label: "Bad", url: "javascript:alert(1)" }] }, mentions: [{ text: "digest", url: "javascript:alert(1)" }] }));
    expect(links()).toEqual([]);
  });

  test("mentions link their substrings in the card text", async () => {
    await render(blocked({ mentions: [{ text: "Desk: the agent card", url: ISSUE }, { text: "store", url: "https://example.org/store" }] }));
    expect(links()).toEqual([
      ["Desk: the agent card", ISSUE],
      ["store", "https://example.org/store"],
      ["Issue", ISSUE],
    ]);
    expect(container.querySelector(".q")!.textContent).toBe('"Desk: the agent card" waits for your ruling.');
  });

  test("without mentions the text renders as before", async () => {
    await render(blocked());
    expect(container.querySelector(".q")!.textContent).toBe('"Desk: the agent card" waits for your ruling.');
    expect(container.querySelector(".q a")).toBeNull();
  });

  test("the card's labels come from the German catalog", async () => {
    await render(blocked(), "de");
    expect(buttons()).toContain("Entscheiden und dem Agenten sagen");
    expect(container.textContent).toContain("Siehe auch:");
    await render(failed(), "de");
    expect(buttons()).toEqual(["Nochmals versuchen lassen"]);
  });
});

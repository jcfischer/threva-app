import { describe, expect, test } from "bun:test";
import { act } from "react";
import { createClient, type Fetch } from "@desk/client";
import type { StudioThread } from "@desk/types";
import { Desk } from "../src/ui/desk/desk";
import { historyBlocks } from "../src/ui/desk/history";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { budgetThread, studioList } from "./fixtures/studio";
import { mountDom } from "./fixtures/dom";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const noFetch: Fetch = async () => new Response("{}");
const thread: StudioThread = {
  ...budgetThread,
  log: [
    { at: "2026-11-10T08:00:00Z", text: "Opened" },
    { at: "2026-11-13T21:00:00Z", text: "Thought overnight." },
  ],
};

describe("the history blocks of a thread", () => {
  test("one block per non-relation note, response and log entry, oldest first", () => {
    const blocks = historyBlocks(thread);
    expect(blocks.map((b) => [b.kind, b.at])).toEqual([
      ["log", "2026-11-10T08:00:00Z"],
      ["note", "2026-11-12T03:12:00Z"],
      ["response", "2026-11-12T09:40:00Z"],
      ["note", "2026-11-13T03:14:00Z"],
      ["log", "2026-11-13T21:00:00Z"],
      ["note", "2026-11-13T20:48:41Z"],
    ].sort((a, b) => Date.parse(a[1]) - Date.parse(b[1])));
    expect(blocks.some((b) => b.text === "This relates to the March offsite.")).toBe(false);
  });

  test("a note shows its first sentence and a log entry its text as sent; a thread without log has no log blocks", () => {
    const blocks = historyBlocks(thread);
    expect(blocks.find((b) => b.kind === "note" && b.at === "2026-11-13T20:48:41Z")?.text).toBe("Ada's draft adds two hires.");
    expect(blocks[0].text).toBe("Opened");
    expect(historyBlocks(budgetThread).some((b) => b.kind === "log")).toBe(false);
  });
});

describe("the history strip on the desk", () => {
  async function mount(locale: "en" | "de", run: (container: HTMLElement) => Promise<void>) {
    const { root, container, cleanup } = mountDom();
    try {
      await act(async () => {
        root.render(<I18nProvider value={createI18n(locale)}>
          <Desk client={createClient(noFetch)} studio={studioList([thread])} slug={thread.slug} backLabel="Back" onBack={() => {}} now={NOW} />
        </I18nProvider>);
      });
      await run(container);
    } finally { await cleanup(); }
  }

  test("has a named, focusable block for each event, and ends labelled", async () => {
    await mount("en", async (container) => {
      const blocks = [...container.querySelectorAll<HTMLButtonElement>("[data-history]")];
      expect(blocks.length).toBe(6);
      expect(new Set(blocks.map((b) => b.getAttribute("data-history")))).toEqual(new Set(["note", "response", "log"]));
      for (const block of blocks) expect(block.getAttribute("aria-label")).toBeTruthy();
      expect(blocks[0].getAttribute("aria-label")).toContain("log entry");
      expect(container.textContent).toContain("Opened");
      expect(container.textContent).toContain("Now");
    });
  });

  test("focus shows the time and the text; a click on a note opens its card, a response or log opens nothing", async () => {
    await mount("en", async (container) => {
      const blocks = [...container.querySelectorAll<HTMLButtonElement>("[data-history]")];
      await act(async () => { blocks[0].focus(); });
      expect(container.querySelector(".desk-history-detail")?.textContent).toContain("Opened");
      await act(async () => { blocks[0].click(); });
      await act(async () => { container.querySelector<HTMLButtonElement>('[data-history="response"]')?.click(); });
      expect(container.querySelector("[data-desk-opened]")).toBeNull();
      await act(async () => { container.querySelector<HTMLButtonElement>('[data-history="note"]')?.click(); });
      expect(container.querySelector('[data-desk-opened="right"]')).not.toBeNull();
    });
  });

  test("a click on a dismissed note's block opens its card", async () => {
    const oldest = thread.notes.filter((n) => n.kind !== "relation").sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
    const dismissed: StudioThread = { ...thread, notes: thread.notes.map((n) => (n === oldest ? { ...n, status: "dismissed" } : n)) };
    const { root, container, cleanup } = mountDom();
    try {
      await act(async () => {
        root.render(<I18nProvider value={createI18n("en")}>
          <Desk client={createClient(noFetch)} studio={studioList([dismissed])} slug={dismissed.slug} backLabel="Back" onBack={() => {}} now={NOW} />
        </I18nProvider>);
      });
      expect(container.querySelector(`[data-desk-card="${oldest.at}"]`)).toBeNull();
      await act(async () => { container.querySelector<HTMLButtonElement>('[data-history="note"]')?.click(); });
      expect(container.querySelector('[data-desk-opened="right"]')).not.toBeNull();
    } finally { await cleanup(); }
  });

  test("is German too", async () => {
    await mount("de", async (container) => {
      expect(container.textContent).toContain("Jetzt");
      expect(container.querySelector("[data-history]")?.getAttribute("aria-label")).toContain("Protokolleintrag");
    });
  });
});

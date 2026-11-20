import { describe, expect, test } from "bun:test";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "@desk/client";
import type { OutlineCommand } from "@desk/types";
import { pathTo } from "../src/ui/everything/moves";
import { draftOf, timeDetails, type TimeDraft } from "../src/ui/everything/time-edit";
import { TimeForm, TimeMargin } from "../src/ui/everything/time-popover";
import { EverythingView } from "../src/ui/everything/view";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { DATE, outlineFixture, row } from "./fixtures/outline";
import { inputText, mountDom } from "./fixtures/dom";

const find = (container: Element, selector: string) => container.querySelector<HTMLElement>(selector);

describe("the command body for an edited time", () => {
  const plain = row("plain", { title: "Book the room" });
  const none: TimeDraft = draftOf(plain);

  test("an untouched field is omitted, a cleared date is empty and a cleared repeat is null", () => {
    const away = row("away", { deferredUntil: "2026-11-16", startDate: "2026-11-17", repeat: { mode: "calendar", unit: "week", interval: 1 } });
    expect(timeDetails(plain, DATE, none)).not.toHaveProperty("startDate");
    expect(timeDetails(plain, DATE, none)).not.toHaveProperty("repeat");
    const cleared = timeDetails(away, DATE, { ...draftOf(away), away: "", repeat: null });
    expect(cleared.deferredUntil).toBe("");
    expect(cleared.repeat).toBeNull();
    expect(cleared).not.toHaveProperty("startDate");
  });

  test("a new repeat counts from the planned date", () => {
    const body = timeDetails(plain, DATE, { ...none, repeat: { mode: "calendar", unit: "week", interval: 1, weekdays: [1] } });
    expect(body.repeat).toEqual({ mode: "calendar", unit: "week", interval: 1, weekdays: [1] });
  });

  test("an edit to the interval of a completion repeat sends the whole object with mode, count and until as returned", () => {
    const counted = row("counted", { repeat: { mode: "completion", unit: "day", interval: 2, count: 5, until: "2027-01-31" } });
    const body = timeDetails(counted, DATE, { ...draftOf(counted), repeat: { ...draftOf(counted).repeat!, interval: 3 } });
    expect(body.repeat).toEqual({ mode: "completion", unit: "day", interval: 3, count: 5, until: "2027-01-31" });
  });

  test("an existing repeat without a mode stays on completion until it is edited", () => {
    expect(draftOf(row("old", { repeat: { unit: "week", interval: 1 } })).repeat?.mode).toBe("completion");
  });
});

describe("the popover", () => {
  test("a row with no time says Set a time, in English and German", () => {
    for (const [locale, text] of [["en", "Set a time"], ["de", "Zeit setzen"]] as const) {
      const html = renderToStaticMarkup(<I18nProvider value={createI18n(locale)}><TimeMargin row={row("plain")} margin="" className="faint" onSave={async () => null} /></I18nProvider>);
      expect(html).toContain(text);
    }
  });

  async function open(refuse?: { status: number; message: string }) {
    const day = outlineFixture();
    const commands: OutlineCommand[] = [];
    const client = createClient(async (_url, init) => {
      if (!init) return Response.json(day);
      const body = JSON.parse(init.body as string) as { command: OutlineCommand };
      commands.push(body.command);
      if (refuse) return Response.json({ message: refuse.message }, { status: refuse.status });
      if (body.command.op === "outline-edit") {
        const node = pathTo(day.outline, body.command.id)!.at(-1)!;
        node.deferredUntil = body.command.details.deferredUntil === "" ? undefined : body.command.details.deferredUntil;
        node.repeat = body.command.details.repeat ?? undefined;
      }
      day.revision += 1;
      return Response.json({ view: day });
    });
    const dom = mountDom();
    await act(async () => dom.root.render(<I18nProvider value={createI18n("en")}><EverythingView client={client} initialDay={day} openRow={{ id: "project", request: 1 }} /></I18nProvider>));
    const margin = () => find(dom.container, '[data-row="plain"] .time-margin button')!;
    return { ...dom, commands, margin };
  }

  test("clicking the margin opens the three fields, and Escape closes it without saving", async () => {
    const { container, commands, margin, cleanup } = await open();
    try {
      expect(margin().textContent).toBe("Set a time");
      await act(async () => margin().click());
      const dialog = find(container, ".time-popover")!;
      expect(dialog.textContent).toContain("Start");
      expect(dialog.textContent).toContain("Put away until");
      expect(dialog.textContent).toContain("Repeat");
      await act(async () => { document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
      expect(find(container, ".time-popover")).toBeNull();
      await act(async () => margin().click());
      await act(async () => { document.body.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })); });
      expect(find(container, ".time-popover")).toBeNull();
      expect(commands).toEqual([]);
    } finally { await cleanup(); }
  });

  test("a change is sent as one edit and the margin shows what Cortex returns", async () => {
    const { container, commands, margin, cleanup } = await open();
    try {
      await act(async () => margin().click());
      await inputText(find(container, ".time-popover")!.querySelectorAll("input")[1], "2026-11-16");
      await act(async () => find(container, ".time-popover button[type=submit]")!.click());
      expect(commands).toHaveLength(1);
      const sent = commands[0];
      expect(sent.op === "outline-edit" && sent.details.deferredUntil).toBe("2026-11-16");
      expect(sent.op === "outline-edit" && "startDate" in sent.details).toBe(false);
      expect(find(container, ".time-popover")).toBeNull();
      expect(margin().textContent).toBe("put away until Mon");
    } finally { await cleanup(); }
  });

  test("a refusal keeps the popover open with one line and the row keeps its old time", async () => {
    const { container, margin, cleanup } = await open({ status: 409, message: "The outline changed. Reload and try again." });
    try {
      await act(async () => margin().click());
      await inputText(find(container, ".time-popover")!.querySelectorAll("input")[0], "2026-11-30");
      await act(async () => find(container, ".time-popover button[type=submit]")!.click());
      expect(find(container, ".time-popover")).not.toBeNull();
      expect(find(container, ".time-popover [role=alert]")!.textContent).toBe("The outline changed. Reload and try again.");
      expect(margin().textContent).toBe("Set a time");
    } finally { await cleanup(); }
  });

  test("a refreshed row keeps the user's edit and takes the other fields from Cortex", async () => {
    const dom = mountDom();
    const view = (r: ReturnType<typeof row>) => <I18nProvider value={createI18n("en")}><TimeForm row={r} onSave={async () => null} /></I18nProvider>;
    try {
      await act(async () => dom.root.render(view(row("plain"))));
      await inputText(find(dom.container, "input")!.parentElement!.parentElement!.querySelectorAll("input")[1], "2026-11-16");
      await act(async () => dom.root.render(view(row("plain", { startDate: "2026-11-20" }))));
      const inputs = dom.container.querySelectorAll("input");
      expect(inputs[0].value).toBe("2026-11-20");
      expect(inputs[1].value).toBe("2026-11-16");
    } finally { await dom.cleanup(); }
  });

  test("the row's page has the same fields", async () => {
    const day = outlineFixture();
    const client = createClient(async () => Response.json(day));
    const dom = mountDom();
    try {
      await act(async () => dom.root.render(<I18nProvider value={createI18n("de")}><EverythingView client={client} initialDay={day} openRow={{ id: "plain", request: 1 }} /></I18nProvider>));
      const section = find(dom.container, ".time-section")!;
      expect(section.textContent).toContain("Beginn");
      expect(section.textContent).toContain("Weggelegt bis");
      expect(section.textContent).toContain("Wiederholung");
    } finally { await dom.cleanup(); }
  });
});

test("the catalog has what the time fields say in both languages", () => {
  for (const locale of ["en", "de"] as const) expect(createI18n(locale).t("time.set")).not.toContain("time.set");
});

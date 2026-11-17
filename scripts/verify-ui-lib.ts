import { join } from "node:path";
import type { DeskView, StudioList } from "../src/ui/api/types";
import type { Page } from "playwright-core";

export type Shot = (label: string, options?: { fullPage: boolean }) => Promise<void>;
export type Journey = (page: Page, shot: Shot) => Promise<void>;

async function showsThreva(page: Page): Promise<void> {
  if ((await page.title()) !== "Threva") throw new Error(`Page title is "${await page.title()}", not "Threva": the stack serves another UI. Check CORTEX_DIR supports mc.ui.dir.`);
  await page.getByRole("heading", { level: 1, name: "Threva" }).waitFor();
  await page.getByRole("group", { name: "View" }).waitFor();
}

async function switchView(page: Page, name: "Day" | "Week" | "Everything"): Promise<void> {
  const button = page.getByRole("group", { name: "View" }).getByRole("button", { name });
  await button.click();
  if ((await button.getAttribute("aria-pressed")) !== "true") throw new Error(`The ${name} button is not pressed after a click.`);
}

async function loaded(page: Page, loadingText: string): Promise<void> {
  await page.getByText(loadingText).waitFor({ state: "hidden", timeout: 20_000 });
}

export const journeys = {
  search: async (page, shot) => {
    await showsThreva(page);
    await loaded(page, "Loading your cards…");
    const bar = page.getByRole("textbox", { name: "Capture, or ask", exact: true });
    const word = `Zephyr${Date.now()}`;
    const note = `${word} is the workshop code`;
    await bar.fill(`note ${note}`);
    await bar.press("Enter");
    const created = page.waitForResponse(response => response.url().endsWith("/api/desk/create") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Keep", exact: true }).click();
    const creation = await created;
    if (!creation.ok()) throw new Error(`Note capture refused: ${await creation.text()}`);
    await bar.waitFor();
    await bar.fill(word);
    await page.getByRole("option", { name: `Search for ${word}` }).click();
    await page.getByRole("button", { name: note, exact: true }).click();
    await page.getByRole("button", { name: "Close result", exact: true }).waitFor();
    await page.locator(".bar1").getByText(note, { exact: true }).last().waitFor();
    await shot("opened-note");
    const absent = `Absent${Date.now()}`;
    await bar.fill(absent);
    await page.getByRole("option", { name: `Search for ${absent}` }).click();
    await page.getByText("Nothing matched.", { exact: true }).waitFor();
    if (await bar.inputValue() !== absent) throw new Error("Search cleared the words after an empty result.");
    await shot("no-matches");
  },
  day: async (page, shot) => {
    await showsThreva(page);
    await loaded(page, "Loading your cards…");
    await shot("day");
    await page.route("**/api/desk", async route => {
      const response = await route.fetch();
      const desk = await response.json() as DeskView;
      await route.fulfill({ response, json: { ...desk, items: [], today: [], myDay: { ...desk.myDay, items: [] } } });
    });
    await page.reload({ waitUntil: "networkidle" });
    await loaded(page, "Loading your cards…");
    const question = page.locator(".card .sub").filter({ hasText: "What goes into next year's budget?" });
    await question.waitFor();
    await page.getByRole("textbox", { name: "Your answer", exact: true }).waitFor();
    await shot("studio-note-wide");
    await page.setViewportSize({ width: 650, height: 900 });
    await shot("studio-note-narrow");
    await page.getByRole("textbox", { name: "Your answer", exact: true }).fill("Day card answer: one hire now, the second in summer.");
    const response = page.waitForResponse(r => r.url().endsWith("/api/desk/studio/act") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const act = await response;
    if (!act.ok()) throw new Error(`Day card respond refused: ${await act.text()}`);
    await question.waitFor({ state: "hidden" });
    await shot("studio-answer-saved");
  },
  desk: async (page, shot) => {
    await showsThreva(page);
    await switchView(page, "Everything");
    await loaded(page, "Loading your outline…");
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page.getByRole("button", { name: "What goes into next year's budget?", exact: true }).click();
    await page.getByRole("button", { name: "Open the desk", exact: true }).click();
    const notes = page.getByRole("complementary", { name: "The assistant's notes", exact: true });
    const parked = notes.getByRole("button").first();
    await parked.click();
    const opened = page.locator('[data-desk-opened="right"]');
    await opened.getByRole("textbox").waitFor();
    await page.waitForFunction(() => document.querySelector('[data-desk-opened="right"]')?.getAttribute("data-placed") === "true");
    const checkLayout = async (stacked: boolean) => {
      const a = await parked.boundingBox();
      const b = await opened.boundingBox();
      const middle = await page.locator('[data-desk="middle"]').boundingBox();
      if (!a || !b || !middle) throw new Error("A desk card has no rendered box.");
      if (stacked) {
        if (b.y < a.y + a.height || Math.abs(b.width - a.width) > 2) throw new Error("The narrow card does not open below its parked card at zone width.");
      } else if (Math.abs(a.y - b.y) > 2 || b.x < middle.x + middle.width - 2) throw new Error("The opened card is not level with its parked card outside the middle.");
    };
    await checkLayout(false);
    await opened.getByText("Details", { exact: true }).click();
    await opened.getByText("Trigger: Sample thread", { exact: true }).waitFor();
    await shot("note-wide");
    await page.setViewportSize({ width: 900, height: 900 });
    await page.waitForFunction(() => {
      const card = document.querySelector('[data-desk-opened="right"]')?.getBoundingClientRect();
      const note = document.querySelector(".desk-notes button")?.getBoundingClientRect();
      return !!card && !!note && card.top >= note.bottom - 1 && Math.abs(card.width - note.width) <= 2;
    });
    await checkLayout(true);
    await shot("note-stacked");
    await page.keyboard.press("Escape");
    await opened.waitFor({ state: "detached" });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await parked.click();
    await opened.getByRole("textbox").fill("One hire now, the second in summer.");
    const response = page.waitForResponse(r => r.url().endsWith("/api/desk/studio/act") && r.request().method() === "POST");
    await opened.getByRole("textbox").press("Enter");
    const act = await response;
    if (!act.ok()) throw new Error(`Studio respond refused: ${await act.text()}`);
    await opened.waitFor({ state: "detached" });
    await page.locator('[data-desk="middle"]').getByText("One hire now, the second in summer.", { exact: false }).waitFor();
    await shot("answer-saved");
    const material = page.getByRole("complementary", { name: "Material", exact: true }).getByRole("button").first();
    await material.click();
    await page.locator('[data-desk-opened="left"]').getByText("Ada Lovelace", { exact: true }).waitFor();
    await shot("material-wide");
    await page.locator('[data-desk-opened="left"]').getByRole("button", { name: "Put back", exact: true }).click();
  },
  relations: async (page, shot) => {
    const response = await page.request.get(new URL("/api/desk/studio", page.url()).href);
    if (!response.ok()) throw new Error(`Studio refused: ${await response.text()}`);
    const data = await response.json() as StudioList;
    const source = data.studio?.active.find(topic => topic.slug === "budget-next-year");
    const relation = source?.notes.find(note => note.kind === "relation" && note.status !== "dismissed" && note.relates?.kind === "thread" && note.relates.label === "offsite-in-march");
    if (!relation) throw new Error("Cortex did not serve the sample relation with relates. Use a fresh dev stack, or add the relation to its budget topic file.");
    await page.reload({ waitUntil: "networkidle" });
    await showsThreva(page);
    await switchView(page, "Everything");
    await loaded(page, "Loading your outline…");
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page.getByRole("button", { name: "What goes into next year's budget?", exact: true }).click();
    await page.getByRole("button", { name: "Open the desk", exact: true }).click();
    await page.setViewportSize({ width: 1920, height: 1080 });
    const notes = page.getByRole("complementary", { name: "The assistant's notes", exact: true });
    await notes.locator("button[data-desk-card]").filter({ hasText: "Relation" }).filter({ hasText: relation.text }).click();
    const right = page.locator('[data-desk-opened="right"]');
    await right.getByRole("button", { name: "Follow", exact: true }).click();
    const left = page.locator('[data-desk-opened="left"]');
    await left.getByText("What is the March offsite for?", { exact: true }).waitFor();
    await left.getByText("Grace asks which of the two weeks works.", { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[data-desk-opened="left"]')?.getAttribute("data-placed") === "true");
    const checkLayout = async () => {
      const a = await left.boundingBox();
      const b = await right.boundingBox();
      const middle = await page.locator('[data-desk="middle"]').boundingBox();
      if (!a || !b || !middle) throw new Error("The followed topic or its relation has no rendered box.");
      if (a.x + a.width > middle.x + 2 || b.x < middle.x + middle.width - 2) throw new Error("An opened relation card covers the draft.");
    };
    await checkLayout();
    await shot("followed-topic-wide");
    await page.setViewportSize({ width: 650, height: 900 });
    await left.getByRole("button", { name: "Open its desk", exact: true }).scrollIntoViewIfNeeded();
    await shot("followed-topic-narrow");
    await left.getByRole("button", { name: "Open its desk", exact: true }).click();
    await page.getByRole("heading", { name: "What is the March offsite for?", exact: true }).waitFor();
    await left.waitFor({ state: "detached" });
    await right.waitFor({ state: "detached" });
    await shot("related-desk");
  },
  week: async (page, shot) => {
    await showsThreva(page);
    const response = await page.request.get(new URL("/api/desk/my-day", page.url()).href);
    let outline = await response.json() as import("../src/ui/api/types").MyDayOutline;
    const change = async (command: Record<string, unknown>) => {
      const result = await page.request.post(new URL("/api/desk/my-day", page.url()).href, { data: { date: outline.date, requestId: crypto.randomUUID(), command: { ...command, revision: outline.revision } } });
      if (!result.ok()) throw new Error(`Week fixture refused: ${await result.text()}`);
      outline = (await result.json() as { view: import("../src/ui/api/types").MyDayOutline }).view;
    };
    await change({ op: "outline-add", parent: "area:work", title: "Prepare the week review" });
    const row = outline.outline.children.flatMap(area => area.children).find(row => row.title === "Prepare the week review");
    if (!row) throw new Error("Week fixture row was not created.");
    await change({ op: "outline-edit", id: row.id, details: { title: row.title, weight: row.weight, note: "Week review notes", ordering: row.ordering, focus: false, dueDate: outline.date, context: "", effort: 1, estimateMinutes: null }, yes: false });
    await switchView(page, "Week");
    await loaded(page, "Loading your week…");
    if (await page.locator("[data-week-date]").count() !== 7) throw new Error("Week does not show seven columns.");
    await page.getByText("Day six planning", { exact: false }).waitFor();
    await page.getByText("Day seven review", { exact: false }).waitFor();
    await page.getByRole("button", { name: /Prepare the week review/ }).waitFor();
    await shot("week-wide");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("week-narrow-start", { fullPage: false });
    await page.locator(".week-scroll").evaluate(element => { element.scrollLeft = element.scrollWidth; });
    const scroll = await page.evaluate(() => {
      const grid = document.querySelector(".week-scroll");
      const header = document.querySelector("header")?.getBoundingClientRect();
      const navigation = document.querySelector(".view-switch")?.getBoundingClientRect();
      return { x: window.scrollX, width: window.innerWidth, body: document.body.scrollWidth, grid: grid?.scrollLeft, header: header && { x: header.x, y: header.y, right: header.right }, navigation: navigation && { x: navigation.x, y: navigation.y, right: navigation.right } };
    });
    if (scroll.x !== 0 || scroll.body > scroll.width || !scroll.grid || !scroll.header || !scroll.navigation || scroll.header.x < 0 || scroll.header.y < 0 || scroll.header.right > scroll.width || scroll.navigation.x < 0 || scroll.navigation.y < 0 || scroll.navigation.right > scroll.width) throw new Error(`Week scroll escaped its strip: ${JSON.stringify(scroll)}`);
    await shot("week-narrow-end", { fullPage: false });
    await page.locator(".week-scroll").evaluate(element => { element.scrollLeft = 0; });
    await page.getByRole("button", { name: /Prepare the week review/ }).click();
    await page.getByRole("heading", { name: "Prepare the week review", exact: true }).waitFor();
    await shot("week-row-page");
    await page.route("**/api/desk/my-day", route => route.fulfill({ status: 503, json: { error: "Synthetic outline unavailable" } }));
    await switchView(page, "Week");
    await page.getByRole("alert").filter({ hasText: "Your outline could not be read." }).waitFor();
    await page.getByText("Day seven review", { exact: false }).waitFor();
    await shot("week-outline-unavailable");
    await page.unroute("**/api/desk/my-day");
    await page.route("**/api/desk", route => route.fulfill({ status: 503, json: { error: "Synthetic Desk unavailable" } }));
    await page.reload({ waitUntil: "networkidle" });
    await switchView(page, "Week");
    await page.getByRole("alert").filter({ hasText: "The Desk could not be read." }).waitFor();
    await page.getByRole("button", { name: /Prepare the week review/ }).waitFor();
    await shot("week-desk-unavailable");
  },
  everything: async (page, shot) => {
    await showsThreva(page);
    await switchView(page, "Everything");
    await loaded(page, "Loading your outline…");
    await shot("everything");
    await switchView(page, "Day");
    await shot("back-to-day");
  },
} satisfies Record<string, Journey>;

export type JourneyName = keyof typeof journeys;

export interface VerifyArgs {
  url: string;
  out: string;
  names: JourneyName[];
}

const isJourney = (name: string): name is JourneyName => Object.hasOwn(journeys, name);

export function parseArgs(argv: readonly string[], env: Readonly<Record<string, string | undefined>>): { ok: true; value: VerifyArgs } | { ok: false; error: string } {
  let url = `http://127.0.0.1:${env.THREVA_DEV_PORT ?? "8790"}/`;
  let out = env.THREVA_VERIFY_OUT ?? join(".verify", new Date().toISOString().replace(/[:.]/g, "-"));
  const names: JourneyName[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--url" || arg === "--out") {
      if (i + 1 >= argv.length) return { ok: false, error: `${arg} needs a value.` };
      const value = argv[i + 1] ?? "";
      if (arg === "--url") url = value;
      else out = value;
      i++;
    } else if (isJourney(arg)) names.push(arg);
    else return { ok: false, error: `Unknown journey "${arg}". Journeys: ${Object.keys(journeys).join(", ")}.` };
  }
  return { ok: true, value: { url, out, names: names.length > 0 ? names : (Object.keys(journeys) as JourneyName[]) } };
}

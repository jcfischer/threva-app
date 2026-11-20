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
    await page.locator(".bar1 .bar-note-text").getByText(note, { exact: true }).waitFor();
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
      await route.fulfill({ response, json: { ...desk, items: desk.items.filter(item => !item.interrupt?.reason) } });
    });
    await page.reload({ waitUntil: "networkidle" });
    await loaded(page, "Loading your cards…");
    const question = page.locator(".card .sub").filter({ hasText: "What goes into next year's budget?" });
    for (let skipped = 0; !(await question.isVisible()) && skipped < 30; skipped += 1) {
      await page.getByRole("button", { name: "Not now", exact: true }).click();
    }
    await question.waitFor();
    const noOldView = async () => {
      for (const name of ["Talk it through", "Continue the conversation", "Discuss", "Sparring", "Think now", "Grill me"]) {
        if (await page.getByText(name, { exact: true }).isVisible()) throw new Error(`Retired Studio control is visible: ${name}`);
      }
      if (await page.locator(".studio.card").count()) throw new Error("The retired Studio open view is mounted.");
    };
    await noOldView();
    await page.getByRole("textbox", { name: "Your answer", exact: true }).waitFor();
    await shot("studio-note-wide");
    await page.setViewportSize({ width: 650, height: 900 });
    await shot("studio-note-narrow");
    await page.getByRole("button", { name: "Open the desk", exact: true }).click();
    await page.locator('[data-desk="middle"]').waitFor();
    await noOldView();
    await shot("studio-desk");
    await page.getByRole("button", { name: "Back to the cards", exact: true }).click();
    await question.waitFor();
    await noOldView();
    const answer = "Day card answer: one hire now, the second in summer.";
    await page.getByRole("textbox", { name: "Your answer", exact: true }).fill(answer);
    const response = page.waitForResponse(r => r.url().endsWith("/api/desk/studio/act") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const act = await response;
    if (!act.ok()) throw new Error(`Day card respond refused: ${await act.text()}`);
    await question.waitFor({ state: "hidden" });
    await noOldView();
    await shot("studio-answer-saved");
    await switchView(page, "Everything");
    await loaded(page, "Loading your outline…");
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page.getByRole("button", { name: "What goes into next year's budget?", exact: true }).click();
    await page.locator(".thread-main").getByText(answer, { exact: false }).waitFor();
    await shot("studio-topic-page");
    await page.getByRole("button", { name: "Open the desk", exact: true }).click();
    await page.locator('[data-desk="middle"]').waitFor();
    await noOldView();
    await page.getByRole("button", { name: "Back to Everything", exact: true }).click();
    await page.locator(".thread-main").getByText(answer, { exact: false }).waitFor();
    await noOldView();
    await shot("studio-topic-page-return");
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
  topic: async (page, shot) => {
    await showsThreva(page);
    await switchView(page, "Everything");
    await loaded(page, "Loading your outline…");
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page.getByRole("button", { name: "What is the March offsite for?", exact: true }).click();
    const draftUrl = new URL("/api/desk/studio/offsite-in-march/draft", page.url()).href;
    const read = await page.request.get(draftUrl);
    if (!read.ok()) throw new Error(`The topic's draft could not be read: ${await read.text()}`);
    const draft = await read.json() as { text: string; revision: string };
    const saved = await page.request.put(draftUrl, { data: { text: `Two days to plan the year. No talks.\n\n${draft.text}`, revision: draft.revision, requestId: crypto.randomUUID() } });
    if (!saved.ok()) throw new Error(`The topic's draft could not be saved: ${await saved.text()}`);
    const revision = (await saved.json() as { revision: string }).revision;
    await page.getByRole("button", { name: "Open the desk", exact: true }).click();
    await page.locator('[data-desk="middle"]').waitFor();
    const act = async (name: string, button: string): Promise<{ act?: string; draftRevision?: string }> => {
      const posted = page.waitForResponse(r => r.url().endsWith("/api/desk/studio/act") && r.request().method() === "POST");
      await page.getByRole("button", { name: button, exact: true }).click();
      const response = await posted;
      if (!response.ok()) throw new Error(`${name} refused: ${await response.text()}`);
      return response.request().postDataJSON() as { act?: string; draftRevision?: string };
    };
    await page.locator('[data-desk-menu="true"] summary').click();
    const park = await act("Park", "Park");
    if (park.act !== "park" || park.draftRevision !== revision) throw new Error(`The park did not carry the draft revision Threva read: ${JSON.stringify(park)}`);
    await page.getByRole("button", { name: "Take it up again", exact: true }).waitFor();
    await shot("topic-parked");
    const unpark = await act("Take it up again", "Take it up again");
    if (unpark.act !== "unpark") throw new Error(`The take-up did not send unpark: ${JSON.stringify(unpark)}`);
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await page.getByRole("radio", { name: "Dropped", exact: true }).check();
    await page.getByLabel("Why it is dropped", { exact: true }).fill("The offsite plans itself this year.");
    const close = await act("Close the topic", "Close the topic");
    if (close.act !== "close" || close.draftRevision !== revision) throw new Error(`The close did not carry the draft revision Threva read: ${JSON.stringify(close)}`);
    await page.locator('[data-desk-outcome="dropped"]').waitFor();
    await page.getByText("The offsite plans itself this year.", { exact: false }).waitFor();
    await shot("topic-closed");
  },
  notes: async (page, shot) => {
    const response = await page.request.get(new URL("/api/desk/studio", page.url()).href);
    if (!response.ok()) throw new Error(`Studio refused: ${await response.text()}`);
    const data = await response.json() as StudioList;
    const source = data.studio?.active.find(topic => topic.slug === "budget-next-year");
    const open = source?.derived?.notes.open ?? [];
    const kept = source?.derived?.notes.kept ?? [];
    if (open.length === 0 && kept.length === 0) throw new Error("Cortex did not serve notes for the sample budget topic. Use a fresh dev stack.");
    await page.reload({ waitUntil: "networkidle" });
    await showsThreva(page);
    await switchView(page, "Everything");
    await loaded(page, "Loading your outline…");
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page.getByRole("button", { name: "What goes into next year's budget?", exact: true }).click();
    const margin = page.locator(".thread-margin-note");
    const keptLines = page.locator(".thread-entry.thread-kept");
    if (open.length > 0) await margin.first().waitFor();
    if (kept.length > 0) await keptLines.first().waitFor();
    if (await margin.count() !== open.length) throw new Error(`The margin shows ${await margin.count()} notes, Cortex serves ${open.length} open.`);
    for (const note of open) await margin.getByText(note.text, { exact: false }).first().waitFor();
    if (await keptLines.count() !== kept.length) throw new Error(`The page shows ${await keptLines.count()} kept notes, Cortex serves ${kept.length}.`);
    for (const note of kept) await keptLines.getByText(note.text, { exact: false }).first().waitFor();
    const served = [...open, ...kept];
    const hidden = source?.notes.filter(note => !served.some(entry => entry.at === note.at)) ?? [];
    for (const note of hidden) {
      if (await page.getByText(note.text, { exact: false }).count() > 0) throw new Error(`A note Cortex leaves out is on the page: ${note.text}`);
    }
    await shot("served-notes-page");
    await page.getByRole("button", { name: "Open the desk", exact: true }).click();
    await page.setViewportSize({ width: 1920, height: 1080 });
    const rail = page.getByRole("complementary", { name: "The assistant's notes", exact: true });
    await rail.locator("button[data-desk-card]").first().waitFor();
    if (await rail.locator("button[data-desk-card]").count() !== open.length + kept.length) throw new Error("The desk notes rail does not show exactly the notes Cortex serves.");
    await shot("served-notes-desk");
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
  "after-meeting": async (page, shot) => {
    await showsThreva(page);
    await loaded(page, "Loading your cards…");
    await page.route("**/api/desk", async route => {
      const response = await route.fetch();
      const desk = await response.json() as DeskView;
      await route.fulfill({ response, json: { ...desk, items: desk.items.filter(item => item.kind === "meeting-after") } });
    });
    await page.reload({ waitUntil: "networkidle" });
    const queue = page.getByRole("region", { name: "Cards" });
    const card = queue.locator(".card[data-item-key]", { has: page.getByText("Meeting over", { exact: true }) }).first();
    await card.waitFor();
    const key = await card.getAttribute("data-item-key");
    if (!key) throw new Error("The after-meeting card has no item key.");
    const dismissed = queue.locator(`[data-item-key=${JSON.stringify(key)}]`);
    await shot("before-dismiss");
    const posted = page.waitForResponse(response => response.url().endsWith("/api/desk/action") && response.request().method() === "POST");
    await card.getByRole("button", { name: "Nothing to note", exact: true }).click();
    const response = await posted;
    if (!response.ok()) throw new Error(`Dismiss refused: ${await response.text()}`);
    const action: unknown = response.request().postDataJSON();
    if (!action || typeof action !== "object" || !("action" in action) || action.action !== "meeting.dismiss" || !("key" in action) || action.key !== key) throw new Error("The dismissal did not target the visible after-meeting card.");
    await dismissed.waitFor({ state: "hidden" });
    const browser = page.context().browser();
    if (!browser) throw new Error("The journey requires a new browser context.");
    const second = await browser.newContext();
    try {
      const stored = await second.request.get(new URL("/api/desk", page.url()).href);
      if (!stored.ok()) throw new Error("The second browser could not read the Desk.");
      const desk = await stored.json() as DeskView;
      if (desk.items.some(item => item.key === key)) throw new Error("The dismissed card returned in a second browser.");
    } finally {
      await second.close();
    }
    await shot("dismissed");
  },
} satisfies Record<string, Journey>;

export type JourneyName = keyof typeof journeys;

const OPT_IN = new Set<JourneyName>(["after-meeting"]);

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
  return { ok: true, value: { url, out, names: names.length > 0 ? names : Object.keys(journeys).filter(isJourney).filter(name => !OPT_IN.has(name)) } };
}

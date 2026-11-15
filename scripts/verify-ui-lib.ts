import { join } from "node:path";
import type { Page } from "playwright-core";

export type Shot = (label: string) => Promise<void>;
export type Journey = (page: Page, shot: Shot) => Promise<void>;

async function showsThreva(page: Page): Promise<void> {
  if ((await page.title()) !== "Threva") throw new Error(`Page title is "${await page.title()}", not "Threva": the stack serves another UI. Check CORTEX_DIR supports mc.ui.dir.`);
  await page.getByRole("heading", { level: 1, name: "Threva" }).waitFor();
  await page.getByRole("group", { name: "View" }).waitFor();
}

async function switchView(page: Page, name: "Day" | "Everything"): Promise<void> {
  const button = page.getByRole("group", { name: "View" }).getByRole("button", { name });
  await button.click();
  if ((await button.getAttribute("aria-pressed")) !== "true") throw new Error(`The ${name} button is not pressed after a click.`);
}

async function loaded(page: Page, loadingText: string): Promise<void> {
  await page.getByText(loadingText).waitFor({ state: "hidden", timeout: 20_000 });
}

export const journeys = {
  day: async (page, shot) => {
    await showsThreva(page);
    await loaded(page, "Loading your cards…");
    await shot("day");
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
      return !!card && !!note && card.top >= note.bottom - 1;
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

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

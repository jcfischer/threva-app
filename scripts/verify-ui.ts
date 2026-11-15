import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright-core";
import { journeys, parseArgs, type Journey } from "./verify-ui-lib";

const parsed = parseArgs(process.argv.slice(2), process.env);
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}
const { url, out, names } = parsed.value;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report: { journey: string; ok: boolean; error?: string; shots: string[]; consoleErrors: string[]; failedRequests: string[] }[] = [];

async function run(name: string, journey: Journey): Promise<void> {
  const page: Page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${String(response.status())} ${response.url()}`);
  });
  const shots: string[] = [];
  const shot = async (label: string, options = { fullPage: true }) => {
    const file = join(out, `${name}-${String(shots.length + 1).padStart(2, "0")}-${label}.png`);
    await page.screenshot({ path: file, fullPage: options.fullPage });
    shots.push(file);
  };
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await journey(page, shot);
    report.push({ journey: name, ok: true, shots, consoleErrors, failedRequests });
  } catch (error) {
    await shot("failure").catch(() => undefined);
    report.push({ journey: name, ok: false, error: error instanceof Error ? error.message : String(error), shots, consoleErrors, failedRequests });
  } finally {
    await page.close();
  }
}

for (const name of names) await run(name, journeys[name]);
await browser.close();

const reportFile = join(out, "report.json");
writeFileSync(reportFile, JSON.stringify({ url, at: new Date().toISOString(), report }, null, 2));
for (const entry of report) {
  console.log(`${entry.ok ? "PASS" : "FAIL"} ${entry.journey}${entry.error ? `: ${entry.error}` : ""}`);
  for (const file of entry.shots) console.log(`  shot ${file}`);
  for (const text of entry.consoleErrors) console.log(`  console error: ${text}`);
  for (const text of entry.failedRequests) console.log(`  http ${text}`);
}
console.log(`report ${resolve(reportFile)}`);
process.exit(report.every((entry) => entry.ok) ? 0 : 1);

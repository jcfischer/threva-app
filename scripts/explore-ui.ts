import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseExploreArgs } from "./explore-ui-lib";

function playwrightShell(): string | undefined {
  const cache = process.platform === "darwin" ? join(homedir(), "Library", "Caches", "ms-playwright") : join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(cache)) return undefined;
  const shells = readdirSync(cache).filter((name) => name.startsWith("chromium_headless_shell-")).sort().reverse();
  for (const dir of shells) {
    for (const sub of readdirSync(join(cache, dir))) {
      const binary = join(cache, dir, sub, "chrome-headless-shell");
      if (existsSync(binary)) return binary;
    }
  }
  return undefined;
}

const parsed = parseExploreArgs(process.argv.slice(2), process.env);
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}
const chrome = process.env.CHROME ?? playwrightShell();
if (!chrome) {
  console.error("No Chromium found. Run: bunx playwright-core install chromium-headless-shell, or set CHROME.");
  process.exit(2);
}
const { url, spec, timeLimit, out } = parsed.value;
const run = Bun.spawnSync(
  ["bunx", "bombadil", "browser", "test", "--headless", "--exit-on-violation", "--time-limit", timeLimit, "--output-path", out, "--output-path-overwrite", url, spec],
  { env: { ...process.env, CHROME: chrome }, stdout: "inherit", stderr: "inherit" },
);
process.exit(run.exitCode);

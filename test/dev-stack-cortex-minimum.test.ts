import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import manifest from "../package.json";
import { checkCortexMinimum, MIN_CORTEX_TAG } from "../scripts/dev-stack-lib";

const dirs: string[] = [];
function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "cortex-min-"));
  dirs.push(dir);
  return dir;
}
function git(dir: string, ...args: string[]): void {
  const r = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.org", "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...args]);
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
}
function commit(dir: string, name: string): void {
  writeFileSync(join(dir, name), name);
  git(dir, "add", ".");
  git(dir, "commit", "-m", name);
}
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("checkCortexMinimum", () => {
  test("starts when HEAD contains the tag", () => {
    const dir = repo();
    git(dir, "init", "-q");
    commit(dir, "a");
    git(dir, "tag", "v6.30.0");
    commit(dir, "b");
    expect(checkCortexMinimum(dir, "v6.30.0")).toEqual({ ok: true, value: expect.stringContaining("v6.30.0") });
  });

  test("refuses a checkout older than the tag, naming found and required", () => {
    const dir = repo();
    git(dir, "init", "-q");
    commit(dir, "a");
    git(dir, "tag", "v6.29.0");
    commit(dir, "b");
    git(dir, "tag", "v6.30.0");
    git(dir, "checkout", "-q", "v6.29.0");
    const r = checkCortexMinimum(dir, "v6.30.0");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("v6.29.0");
      expect(r.error).toContain("update CORTEX_DIR to v6.30.0 or later");
    }
  });

  test("fails closed when the tag is unknown", () => {
    const dir = repo();
    git(dir, "init", "-q");
    commit(dir, "a");
    const r = checkCortexMinimum(dir, "v6.30.0");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("fetch tags");
  });

  test("declares a release tag", () => {
    expect(MIN_CORTEX_TAG).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  test("the dependency pin and default dev stack require releases with Desk search", () => {
    const cortexSource = "github:the-metafactory/cortex#";
    const dependency = manifest.devDependencies["@the-metafactory/cortex"];
    expect(dependency.startsWith(cortexSource)).toBe(true);
    expect(Bun.semver.satisfies(dependency.slice(cortexSource.length), ">=6.34.0")).toBe(true);
    expect(Bun.semver.satisfies(MIN_CORTEX_TAG, ">=6.34.0")).toBe(true);

    const dir = repo();
    git(dir, "init", "-q");
    commit(dir, "before-search");
    git(dir, "tag", "v6.33.0");
    commit(dir, "with-search");
    git(dir, "tag", MIN_CORTEX_TAG);
    git(dir, "checkout", "-q", "v6.33.0");
    expect(checkCortexMinimum(dir).ok).toBe(false);
    git(dir, "checkout", "-q", MIN_CORTEX_TAG);
    expect(checkCortexMinimum(dir)).toEqual({ ok: true, value: MIN_CORTEX_TAG });
  });
});

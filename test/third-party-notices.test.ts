import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { noticeEntries, noticesProblems, renderEntry, renderNotices } from "../scripts/third-party-notices-lib";

const root = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const manifest = JSON.parse(read("package.json"));
const entries = noticeEntries(root);
const notices = read("THIRD-PARTY-NOTICES.md");

describe("licence declaration", () => {
  test("package.json declares AGPL-3.0-only and stays private", () => {
    expect(manifest.license).toBe("AGPL-3.0-only");
    expect(manifest.private).toBe(true);
  });

  test("LICENSE holds the GNU AGPL version 3 text", () => {
    const licence = read("LICENSE");
    expect(licence).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");
    expect(licence).toContain("Version 3, 19 November 2007");
    expect(licence).toContain("END OF TERMS AND CONDITIONS");
  });

  test("README has a Licence section pointing at both files", () => {
    const readme = read("README.md");
    const start = readme.indexOf("## Licence");
    expect(start).toBeGreaterThanOrEqual(0);
    const section = readme.slice(start);
    expect(section).toContain("AGPL-3.0-only");
    expect(section).toContain("LICENSE");
    expect(section).toContain("THIRD-PARTY-NOTICES.md");
  });
});

describe("third-party notices", () => {
  test("names every runtime dependency with its version, licence and full licence text", () => {
    const names = entries.map((entry) => entry.name);
    for (const name of Object.keys(manifest.dependencies)) expect(names).toContain(name);
    expect(noticesProblems(notices, entries)).toEqual([]);
  });

  test("names the packages the declared dependencies pull in", () => {
    const names = entries.map((entry) => entry.name);
    for (const name of ["scheduler", "@lezer/common", "@lezer/lr", "style-mod", "w3c-keyname", "crelt"]) {
      expect(names).toContain(name);
    }
  });

  test("a transitive package dropped from the notices is named", () => {
    const scheduler = entries.find((entry) => entry.name === "scheduler");
    if (scheduler === undefined) throw new Error("scheduler is not listed in the notices");
    const without = notices.replace(renderEntry(scheduler), "");
    const problems = noticesProblems(without, entries);
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain("scheduler");
  });

  test("a heading inside a licence text is not read as a listed package", () => {
    const quirky = [...entries, { name: "quirky", version: "1.0.0", licence: "MIT", text: "MIT License\n\n## Redistribution is not permitted" }];
    expect(noticesProblems(renderNotices(quirky), quirky)).toEqual([]);
  });

  test("matches what the generator writes", () => {
    expect(notices).toBe(renderNotices(entries));
  });

  test("a runtime dependency added to package.json but missing from the notices is named", () => {
    const fixture = mkdtempSync(join(tmpdir(), "threva-notices-"));
    try {
      writeFileSync(join(fixture, "package.json"), JSON.stringify({ dependencies: {} }));
      const before = "# Third-party notices\n";
      expect(noticesProblems(before, noticeEntries(fixture))).toEqual([]);
      writeFileSync(join(fixture, "package.json"), JSON.stringify({ dependencies: { "new-runtime-package": "1.0.0" } }));
      const installed = join(fixture, "node_modules", "new-runtime-package");
      mkdirSync(installed, { recursive: true });
      writeFileSync(join(installed, "package.json"), JSON.stringify({ name: "new-runtime-package", version: "1.0.0", license: "MIT" }));
      writeFileSync(join(installed, "LICENSE"), "MIT License\nFixture copyright\n");
      const added = noticeEntries(fixture);
      const problems = noticesProblems(before, added);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("new-runtime-package");
      const complete = `${before}\n## new-runtime-package 1.0.0\n\nLicense: MIT\n\n\`\`\`\nMIT License\nFixture copyright\n\`\`\`\n`;
      expect(noticesProblems(complete, added)).toEqual([]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("a dependency whose notices block is stale is named", () => {
    const bumped = entries.map((entry) => (entry.name === "react" ? { ...entry, version: "19.0.0" } : entry));
    const problems = noticesProblems(notices, bumped);
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain("react 19.0.0");
  });

  test("a listed package that is no longer a runtime dependency is named", () => {
    const shrunk = entries.filter((entry) => entry.name !== "react-dom");
    const problems = noticesProblems(notices, shrunk);
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain("react-dom");
  });
});

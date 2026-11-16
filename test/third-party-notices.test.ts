import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { noticeEntries, noticesProblems, renderNotices } from "../scripts/third-party-notices-lib";

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
    const section = readme.slice(readme.indexOf("## Licence"));
    expect(section).not.toBe("");
    expect(section).toContain("AGPL-3.0-only");
    expect(section).toContain("LICENSE");
    expect(section).toContain("THIRD-PARTY-NOTICES.md");
  });
});

describe("third-party notices", () => {
  test("names every runtime dependency with its version, licence and full licence text", () => {
    expect(entries.map((entry) => entry.name)).toEqual(Object.keys(manifest.dependencies).sort((a, b) => a.localeCompare(b)));
    expect(noticesProblems(notices, entries)).toEqual([]);
  });

  test("matches what the generator writes", () => {
    expect(notices).toBe(renderNotices(entries));
  });

  test("a runtime dependency added to package.json but missing from the notices is named", () => {
    const added = [...entries, { name: "left-pad", version: "1.3.0", licence: "MIT", text: "MIT License" }];
    const problems = noticesProblems(notices, added);
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain("left-pad");
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

import { expect, test } from "bun:test";
import { deployConfig, deskApiServes, parseDeskApiVersion, scriptsOf } from "../scripts/deploy-local-lib";

test("defaults deploy into ~/.local/share/threva against the local Cortex", () => {
  expect(deployConfig({}, [], "/home/someone")).toEqual({
    sourceDir: "/home/someone/.local/share/threva/src",
    uiDir: "/home/someone/.local/share/threva/ui",
    cortexUrl: "http://127.0.0.1:8767",
    repoUrl: "https://github.com/jcfischer/threva-app.git",
    force: false,
  });
});

test("environment and --force override the defaults", () => {
  const config = deployConfig({ THREVA_UI_DIR: "/srv/ui", THREVA_DEPLOY_SOURCE: "/srv/src", THREVA_CORTEX_URL: "http://127.0.0.1:9000/" }, ["--force"], "/home/someone");
  expect(config).toMatchObject({ uiDir: "/srv/ui", sourceDir: "/srv/src", cortexUrl: "http://127.0.0.1:9000", force: true });
});

test("reads the Desk API version a build was made against", () => {
  expect(parseDeskApiVersion('export const DESK_API_VERSION = "1.15.0";\n')).toBe("1.15.0");
  expect(parseDeskApiVersion("export {};")).toBeNull();
});

test("a Cortex serves a build when the major matches and it is not older", () => {
  expect(deskApiServes("1.15.0", "1.5.0")).toBe(true);
  expect(deskApiServes("1.5.0", "1.5.0")).toBe(true);
  expect(deskApiServes("1.5.1", "1.5.0")).toBe(true);
  expect(deskApiServes("1.4.9", "1.5.0")).toBe(false);
  expect(deskApiServes("1.5.0", "1.5.1")).toBe(false);
  expect(deskApiServes("2.0.0", "1.5.0")).toBe(false);
  expect(deskApiServes("1.15", "1.5.0")).toBe(false);
});

test("lists the scripts a page loads, relative to its directory", () => {
  expect(scriptsOf('<script type="module" crossorigin src="./chunk-163bmv3t.js"></script><script src="/other.js"></script>')).toEqual(["chunk-163bmv3t.js", "other.js"]);
});

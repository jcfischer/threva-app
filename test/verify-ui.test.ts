import { describe, expect, test } from "bun:test";
import { parseArgs } from "../scripts/verify-ui-lib";
import { parseExploreArgs } from "../scripts/explore-ui-lib";

describe("verify:ui arguments", () => {
  test("runs every journey against the dev port when nothing is named", () => {
    const parsed = parseArgs([], { THREVA_DEV_PORT: "8791", THREVA_VERIFY_OUT: "out" });
    expect(parsed).toEqual({ ok: true, value: { url: "http://127.0.0.1:8791/", out: "out", names: ["day", "everything"] } });
  });

  test("takes named journeys, a URL and an output directory", () => {
    const parsed = parseArgs(["everything", "--url", "http://x/", "--out", "o"], {});
    expect(parsed).toEqual({ ok: true, value: { url: "http://x/", out: "o", names: ["everything"] } });
  });

  test("refuses an unknown journey and a flag without a value", () => {
    expect(parseArgs(["mail"], {})).toEqual({ ok: false, error: 'Unknown journey "mail". Journeys: day, everything.' });
    expect(parseArgs(["--out"], {})).toEqual({ ok: false, error: "--out needs a value." });
  });
});

describe("explore:ui arguments", () => {
  test("defaults to the Threva spec for three minutes on the dev port", () => {
    expect(parseExploreArgs([], { THREVA_DEV_PORT: "8791" })).toEqual({
      ok: true,
      value: { url: "http://127.0.0.1:8791/", spec: "explore/threva.ts", timeLimit: "3m", out: ".verify/explore" },
    });
  });

  test("refuses a time limit without a unit and an unknown option", () => {
    expect(parseExploreArgs(["--time-limit", "90"], {})).toEqual({ ok: false, error: '--time-limit takes a number with s, m, h or d, not "90".' });
    expect(parseExploreArgs(["--headed", "x"], {}).ok).toBe(false);
  });
});

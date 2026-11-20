import { describe, expect, test } from "bun:test";
import { journeys, parseArgs } from "../scripts/verify-ui-lib";
import { parseExploreArgs } from "../scripts/explore-ui-lib";

describe("verify:ui arguments", () => {
  test("runs the default journeys without dismissing a meeting when nothing is named", () => {
    const parsed = parseArgs([], { THREVA_DEV_PORT: "8791", THREVA_VERIFY_OUT: "out" });
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value.url).toBe("http://127.0.0.1:8791/");
    expect(parsed.value.out).toBe("out");
    expect(parsed.value.names).toEqual(["search", "day", "desk", "notes", "week", "everything"]);
  });

  test("runs the after-meeting dismissal only when explicitly named", () => {
    const parsed = parseArgs(["after-meeting"], {});
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value.names).toEqual(["after-meeting"]);
  });

  test("takes named journeys, a URL and an output directory", () => {
    const parsed = parseArgs(["everything", "--url", "http://x/", "--out", "o"], {});
    expect(parsed).toEqual({ ok: true, value: { url: "http://x/", out: "o", names: ["everything"] } });
  });

  test("refuses an unknown journey and a flag without a value", () => {
    for (const name of ["mail", "relations"]) expect(parseArgs([name], {})).toEqual({ ok: false, error: `Unknown journey "${name}". Journeys: ${Object.keys(journeys).join(", ")}.` });
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

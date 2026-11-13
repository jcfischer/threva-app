import { expect, test } from "bun:test";
import { cortexUrl } from "../src/cortex-origin";

test("builds a URL on the local Mission Control origin", () => {
  expect(cortexUrl("/api/desk")).toBe("http://127.0.0.1:8767/api/desk");
});

test("refuses a path outside the API", () => {
  expect(() => cortexUrl("/index.html")).toThrow();
});

import { expect, test } from "bun:test";
import { cortexUrl } from "../src/cortex-origin";

test("refuses a path outside the API", () => {
  expect(() => cortexUrl("/index.html")).toThrow();
});

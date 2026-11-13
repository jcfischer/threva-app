import { expect, test } from "bun:test";
import { safeHref } from "../src/ui/api/safe-link";

test("allows web and Apple Mail links", () => {
  expect(safeHref("https://example.org/brief")).toBe("https://example.org/brief");
  expect(safeHref("http://example.org")).toBe("http://example.org");
  expect(safeHref("message:%3Cid@example.org%3E")).toBe("message:%3Cid@example.org%3E");
});

test("refuses script, data and unparseable links", () => {
  expect(safeHref("javascript:alert(1)")).toBeUndefined();
  expect(safeHref("JavaScript:alert(1)")).toBeUndefined();
  expect(safeHref("data:text/html,<b>x</b>")).toBeUndefined();
  expect(safeHref("not a url")).toBeUndefined();
  expect(safeHref(undefined)).toBeUndefined();
});

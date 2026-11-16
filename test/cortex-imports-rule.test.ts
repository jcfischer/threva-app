import { describe, expect, test } from "bun:test";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { cortexImportRules } from "../eslint/cortex-imports";

const linter = new Linter({ configType: "flat" });
const config: Linter.Config[] = [
 {
  files: ["**/*.ts"],
  languageOptions: { parser: tseslint.parser },
  plugins: { "@typescript-eslint": tseslint.plugin },
  rules: cortexImportRules,
 },
];
const flagged = (code: string) =>
 linter
  .verify(code, config, "x.ts")
  .filter((m) => m.ruleId === "@typescript-eslint/no-restricted-imports")
  .map((m) => m.line);

describe("@typescript-eslint/no-restricted-imports for Cortex", () => {
 test("allows a type import and a type re-export of desk-api", () => {
  expect(flagged('import type { DeskItem } from "@the-metafactory/cortex/desk-api";\nexport type { DeskView } from "@the-metafactory/cortex/desk-api";\n')).toEqual([]);
  expect(flagged('import { type DeskItem, type DeskView } from "@the-metafactory/cortex/desk-api";\nvoid 0;\n')).toEqual([]);
 });

 test("refuses a runtime import of desk-api", () => {
  expect(flagged('import { DESK_API_VERSION } from "@the-metafactory/cortex/desk-api";\nvoid DESK_API_VERSION;\n')).toEqual([1]);
 });

 test("refuses a type import from the bare package and from a deeper desk-api path", () => {
  expect(flagged('import type { DeskItem } from "@the-metafactory/cortex";\n')).toEqual([1]);
  expect(flagged('import type { DeskItem } from "@the-metafactory/cortex/desk-api/internal";\n')).toEqual([1]);
 });

 test("refuses a type import from any other Cortex subpath", () => {
  expect(flagged('import type { Server } from "@the-metafactory/cortex/internal";\n')).toEqual([1]);
  expect(flagged('import type { Server } from "@the-metafactory/cortex/surface/mc/server";\n')).toEqual([1]);
 });

 test("leaves every other package alone", () => {
  expect(flagged('import { describe } from "bun:test";\nimport type { ReactNode } from "react";\nvoid [describe, 0 as unknown as ReactNode];\n')).toEqual([]);
 });
});

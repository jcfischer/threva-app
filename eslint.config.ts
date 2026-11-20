import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import { cortexImportRules } from "./eslint/cortex-imports.ts";
import { threva } from "./eslint/no-comments.ts";

const testCarveOut = Object.fromEntries(
  [
    "no-explicit-any",
    "no-non-null-assertion",
    "no-unsafe-assignment",
    "no-unsafe-member-access",
    "no-unsafe-call",
    "no-unsafe-argument",
    "no-unsafe-return",
    "no-floating-promises",
    "no-misused-promises",
    "restrict-template-expressions",
    "no-unused-vars",
    "no-deprecated",
    "require-await",
    "no-confusing-void-expression",
    "await-thenable",
    "no-unnecessary-condition",
    "no-empty-function",
    "unbound-method",
  ].map((rule) => [`@typescript-eslint/${rule}`, "off"]),
);

export default defineConfig(
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    linterOptions: { noInlineConfig: true },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { threva },
    rules: {
      "threva/no-comments": "error",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true, allowBoolean: true }],
      ...cortexImportRules,
    },
  },
  { files: ["test/**/*.ts", "test/**/*.tsx"], rules: testCarveOut },
  { ignores: ["node_modules/", "dist/", "docs/", ".claude/", "eslint.config.ts"] },
);

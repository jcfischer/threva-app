import type { Linter } from "eslint";

export const CORTEX_IMPORT_MESSAGE =
 "Import Cortex types only, and only through @the-metafactory/cortex/desk-api, because Threva reaches Cortex over HTTP.";

export const cortexImportRules: NonNullable<Linter.Config["rules"]> = {
 "@typescript-eslint/no-restricted-imports": [
  "error",
  {
   patterns: [
    {
     regex: "^@the-metafactory/cortex(?:$|/(?!desk-api$))",
     message: CORTEX_IMPORT_MESSAGE,
     allowTypeImports: false,
    },
    {
     regex: "^@the-metafactory/cortex/desk-api$",
     message: CORTEX_IMPORT_MESSAGE,
     allowTypeImports: true,
    },
   ],
  },
 ],
};

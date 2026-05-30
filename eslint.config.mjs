import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    "out/**",
    "ios/**",
    "android/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

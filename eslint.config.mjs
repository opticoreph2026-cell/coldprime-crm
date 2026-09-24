import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "eslint-config-next/core-web-vitals";
import nextTsPlugin from "eslint-config-next/typescript";

export default defineConfig([
  ...nextPlugin,
  ...nextTsPlugin,
  {
    rules: {
      // Data-fetch-on-mount is the established pattern in this app
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "lib/prisma/client/**",
    "next-env.d.ts",
    "*.config.js",
    "*.config.mjs",
  ]),
]);

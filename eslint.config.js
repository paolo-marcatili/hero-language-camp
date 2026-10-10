import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Baseline policy: legacy findings are warnings so `npm run lint` passes today. Only rules-of-hooks can fail the build.
function warnOnly(configs) {
  const demote = (level) => {
    const severity = Array.isArray(level) ? level[0] : level;
    if (severity === "off" || severity === 0) return level;
    return Array.isArray(level) ? ["warn", ...level.slice(1)] : "warn";
  };
  return configs.map((c) => (c.rules ? { ...c, rules: Object.fromEntries(Object.entries(c.rules).map(([k, v]) => [k, demote(v)])) } : c));
}

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "site/**",
    "redirect-site/**",
    ".pages-preview/**",
    ".venv/**",
    ".local-data/**",
    "labbooks/**",
    "content-packs/**",
    "asset-packs/**",
    "apps/*/public/**",
    "docs/**",
    "android/**",
    "ios/**",
    "tools/archive/**",
    "coverage/**"
  ]),
  ...warnOnly([js.configs.recommended, ...tseslint.configs.recommended]),
  { files: ["**/*.{ts,tsx}"], languageOptions: { globals: { ...globals.browser } } },
  {
    files: ["tools/**/*.{js,mjs}", "*.config.{js,ts}", "apps/*/vite.config.ts", "apps/web/vitest.setup.ts", "capacitor.config.ts"],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn" }
  },
  { rules: { "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": "off" } } // tsc noUnusedLocals/Parameters owns this
]);

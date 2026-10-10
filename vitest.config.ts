import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // mirrors tools/tests/helpers.mjs: @hero-lang/<pkg> -> packages/<pkg>/src/index.ts
    alias: {
      "@hero-lang/content-schema": fromRoot("./packages/content-schema/src/index.ts"),
      "@hero-lang/learning-engine": fromRoot("./packages/learning-engine/src/index.ts"),
      "@hero-lang/foundations-engine": fromRoot("./packages/foundations-engine/src/index.ts")
    }
  },
  test: {
    environment: "jsdom",
    include: ["apps/web/src/**/*.test.{ts,tsx}"],
    setupFiles: ["./apps/web/vitest.setup.ts"],
    globals: false
  }
});

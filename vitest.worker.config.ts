import { defineConfig } from "vitest/config";

// Worker tests run in Node against a real D1 (SQLite) database provided by
// Miniflare, separate from the jsdom-based UI tests in vitest.config.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["worker/test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

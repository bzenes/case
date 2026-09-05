import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globalSetup: "./tests/setup/global-setup.ts",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration tests share one embedded Postgres + truncate-based reset
    // between files; running files in parallel would let them stomp on each
    // other's data. The deliberate concurrency in TESTING.md #3 happens
    // *within* a single test via Promise.all, not across files.
    fileParallelism: false,
  },
});

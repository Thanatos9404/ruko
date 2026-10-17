import { defineConfig } from "vitest/config";

/** Standalone test config for server/ml (run: npx vitest run --config server/ml/vitest.config.ts). */
export default defineConfig({
  test: {
    include: ["server/ml/__tests__/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
  },
});

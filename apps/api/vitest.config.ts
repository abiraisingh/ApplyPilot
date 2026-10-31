import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    testTimeout: 15000,
    exclude: ["**/node_modules/**", "**/dist/**"],
    globalSetup: ["./src/test/global-setup.ts"],
  },
});

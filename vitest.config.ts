import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const bunTestShim = fileURLToPath(new URL("./tests/shims/bun-test.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "bun:test": bunTestShim,
    },
  },
  test: {
    include: ["packages/**/tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "tests/live/**"],
    environment: "node",
  },
});

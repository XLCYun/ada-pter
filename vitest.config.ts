import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const bunTestShim = fileURLToPath(
  new URL("./tests/shims/bun-test.ts", import.meta.url),
);

const adaPterSrc = fileURLToPath(
  new URL("./packages/ada-pter/src", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [
      { find: "bun:test", replacement: bunTestShim },
      { find: /^ada-pter$/, replacement: `${adaPterSrc}/index.ts` },
      { find: /^ada-pter\/(.+)$/, replacement: `${adaPterSrc}/$1` },
    ],
  },
  test: {
    include: ["packages/**/tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "tests/live/**"],
    environment: "node",
  },
});

import { describe, expect, test } from "bun:test";
import { defineProvider } from "../src/provider";
import type { Provider } from "../src/types/provider";

// ─── Helpers ────────────────────────────────────────────────────────────────

function validConfig(): Provider {
  return {
    name: "test",
    getHandler: () => ({
      getRequestConfig: () => ({
        url: "https://api.test.com/v1",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
      responseTransformers: [
        async (ctx) => {
          ctx.response.data = await ctx.response.raw!.json();
        },
      ],
    }),
  };
}

// ─── defineProvider ─────────────────────────────────────────────────────────

describe("defineProvider", () => {
  test("returns a frozen object for valid config", () => {
    const provider = defineProvider(validConfig());
    expect(provider.name).toBe("test");
    expect(Object.isFrozen(provider)).toBe(true);
  });

  test("throws when name is missing", () => {
    const config = validConfig();
    (config as any).name = "";
    expect(() => defineProvider(config)).toThrow("name");
  });

  test("throws when getHandler is missing", () => {
    const config = validConfig();
    (config as any).getHandler = undefined;
    expect(() => defineProvider(config)).toThrow("getHandler");
  });

  test("accepts config without match (no match field on Provider)", () => {
    const provider = defineProvider(validConfig());
    expect(provider.name).toBe("test");
  });

  test("extra properties do not cause errors", () => {
    const config = { ...validConfig(), customField: "extra" } as any;
    const provider = defineProvider(config);
    expect(provider.name).toBe("test");
  });
});

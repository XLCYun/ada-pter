import { describe, expect, test } from "bun:test";
import { resolveRequestBase } from "../src/utils";

describe("@ada-pter/openai utils", () => {
  test("resolveRequestBase throws when base is missing", () => {
    const ctx = {
      config: {
        apiKey: "sk-test",
        apiBase: "", // explicitly empty to bypass default
      },
    } as any;

    expect(() => resolveRequestBase(ctx)).toThrow("No base URL provided");
  });
});

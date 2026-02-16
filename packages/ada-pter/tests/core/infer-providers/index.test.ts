/// <reference path="../../bun-test.d.ts" />

import { describe, expect, test } from "bun:test";
import { inferProvider } from "../../../src/core/infer-providers";

describe("inferProvider", () => {
  test("returns provider from registry when model exists", () => {
    expect(inferProvider("gpt-5")).toBe("openai");
  });

  test("returns provider from registry when model exists (case insensitive)", () => {
    expect(inferProvider("GPT-5")).toBe("openai");
  });

  test("falls back to OpenAI inference when registry miss", () => {
    expect(inferProvider("gpt-not-exists-model")).toBe("openai");
  });

  test("returns custom when no provider matches", () => {
    expect(inferProvider("")).toBe("custom");
  });
});

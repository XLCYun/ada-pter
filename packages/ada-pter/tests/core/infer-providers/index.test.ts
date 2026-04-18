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

  test("returns anthropic from registry", () => {
    expect(inferProvider("claude-opus-4-7")).toBe("anthropic");
    expect(inferProvider("claude-sonnet-4-6")).toBe("anthropic");
  });

  test("falls back to Anthropic inference when registry miss", () => {
    expect(inferProvider("claude-future-model")).toBe("anthropic");
  });

  test("returns custom when no provider matches", () => {
    expect(inferProvider("")).toBe("custom");
  });
});

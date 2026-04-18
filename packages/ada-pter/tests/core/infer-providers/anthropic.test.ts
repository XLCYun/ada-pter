/// <reference path="../../bun-test.d.ts" />

import { describe, expect, test } from "bun:test";
import { inferAnthropicProvider } from "../../../src/core/infer-providers/anthropic";

describe("inferAnthropicProvider", () => {
  test("returns anthropic for claude-* models", () => {
    expect(inferAnthropicProvider("claude-opus-4-7")).toBe("anthropic");
    expect(inferAnthropicProvider("claude-sonnet-4-6")).toBe("anthropic");
    expect(inferAnthropicProvider("claude-3-haiku-20240307")).toBe("anthropic");
  });

  test("returns null for non-claude models", () => {
    expect(inferAnthropicProvider("gpt-4o")).toBeNull();
    expect(inferAnthropicProvider("mistral-large")).toBeNull();
  });

  test("returns null for empty model names", () => {
    expect(inferAnthropicProvider("")).toBeNull();
  });
});

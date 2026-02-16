/// <reference path="../../bun-test.d.ts" />

import { describe, expect, test } from "bun:test";
import { inferOpenAIProvider } from "../../../src/core/infer-providers/openai";

describe("inferOpenAIProvider", () => {
  test("returns openai for gpt-* models", () => {
    expect(inferOpenAIProvider("gpt-4o-mini")).toBe("openai");
    expect(inferOpenAIProvider("gpt-3.5-turbo")).toBe("openai");
  });

  test("returns openai for chatgpt-* models", () => {
    expect(inferOpenAIProvider("chatgpt-4o")).toBe("openai");
  });

  test("returns null for unknown providers", () => {
    expect(inferOpenAIProvider("claude-3-sonnet")).toBeNull();
    expect(inferOpenAIProvider("mistral-large")).toBeNull();
  });

  test("returns null for empty model names", () => {
    expect(inferOpenAIProvider("")).toBeNull();
  });
});

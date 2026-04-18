/// <reference path="../../bun-test.d.ts" />

import { describe, expect, test } from "bun:test";
import { MODEL_PROVIDER_REGISTRY } from "../../../src/core/infer-providers/registry";

describe("MODEL_PROVIDER_REGISTRY", () => {
  test("contains the default OpenAI entry", () => {
    expect(MODEL_PROVIDER_REGISTRY).toMatchObject({ "gpt-5.2": "openai" });
  });

  test("contains Anthropic models", () => {
    expect(MODEL_PROVIDER_REGISTRY).toMatchObject({ "claude-opus-4-7": "anthropic" });
    expect(MODEL_PROVIDER_REGISTRY).toMatchObject({ "claude-sonnet-4-6": "anthropic" });
    expect(MODEL_PROVIDER_REGISTRY).toMatchObject({ "claude-3-haiku-20240307": "anthropic" });
  });
});

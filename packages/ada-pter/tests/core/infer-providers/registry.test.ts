/// <reference path="../../bun-test.d.ts" />

import { describe, expect, test } from "bun:test";
import { MODEL_PROVIDER_REGISTRY } from "../../../src/core/infer-providers/registry";

describe("MODEL_PROVIDER_REGISTRY", () => {
  test("contains the default OpenAI entry", () => {
    expect(MODEL_PROVIDER_REGISTRY).toMatchObject({ "gpt-5.2": "openai" });
  });
});

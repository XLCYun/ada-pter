/// <reference path="../bun-test.d.ts" />

import { describe, expect, test } from "bun:test";
import { createArrayBufferTransformer } from "../../src/transformers/array-buffer";
import type { AdapterContext } from "../../src/types/core";

function makeCtx(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    apiType: "completion",
    config: { messages: [] },
    state: {},
    modelId: "test/gpt-4",
    providerKey: "test",
    model: "gpt-4",
    normModel: "gpt-4",
    normProvider: "test",
    normModelId: "test/gpt-4",
    provider: { name: "test", getHandler: () => null },
    handler: undefined,
    request: {
      url: "https://api.test.com/v1/completions",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4", messages: [] }),
    },
    response: {},
    ...overrides,
  };
}

describe("array buffer transformer", () => {
  test("sets response.data to ArrayBuffer when raw response exists", async () => {
    const transformer = createArrayBufferTransformer();
    const body = "hello world";
    const ctx = makeCtx({
      response: {
        raw: new Response(body, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      },
    });

    await transformer(ctx);

    expect(ctx.response.data).toBeInstanceOf(ArrayBuffer);
    const text = new TextDecoder().decode(
      new Uint8Array(ctx.response.data as ArrayBuffer),
    );
    expect(text).toBe(body);
  });

  test("leaves response.data undefined when raw response is missing", async () => {
    const transformer = createArrayBufferTransformer();
    const ctx = makeCtx({ response: {} });

    await transformer(ctx);

    expect(ctx.response.data).toBeUndefined();
  });
});

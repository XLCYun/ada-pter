/// <reference path="../bun-test.d.ts" />

import { describe, expect, test } from "bun:test";
import { createSseTransformer } from "../../src/transformers/sse";
import type { AdapterContext } from "../../src/types/core";

describe("SSE transformer", () => {
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

  test("handles SSE response with null body", async () => {
    const transformer = createSseTransformer();
    const ctx = makeCtx({
      response: {
        raw: new Response(null, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      },
    });

    await transformer(ctx);

    // Should set response.data to an empty async generator
    expect(ctx.response.data).toBeDefined();

    const stream = ctx.response.data as AsyncIterable<unknown>;
    const out: unknown[] = [];
    for await (const v of stream) out.push(v);

    // Should yield nothing (empty generator)
    expect(out).toEqual([]);
  });

  test("handles SSE response with undefined body", async () => {
    const transformer = createSseTransformer();
    const ctx = makeCtx({
      response: {
        raw: new Response(undefined, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      },
    });

    await transformer(ctx);

    // Should set response.data to an empty async generator
    expect(ctx.response.data).toBeDefined();

    const stream = ctx.response.data as AsyncIterable<unknown>;
    const out: unknown[] = [];
    for await (const v of stream) out.push(v);

    // Should yield nothing (empty generator)
    expect(out).toEqual([]);
  });

  test("falls back to raw string when JSON parsing fails", async () => {
    const transformer = createSseTransformer();

    // Create SSE body with malformed JSON that looks like JSON
    const sseBody = [
      'data: {"valid": "json"}\n\n',
      'data: {"invalid": json, missing: quotes}\n\n', // This will fail JSON.parse
      'data: {"another": "valid"}\n\n',
      "data: just a regular string\n\n",
      'data: {"malformed": "json",}\n\n', // Trailing comma makes it invalid JSON
    ].join("");

    const response = new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });

    const ctx = makeCtx({
      response: { raw: response },
    });

    await transformer(ctx);

    const stream = ctx.response.data as AsyncIterable<unknown>;
    const out: unknown[] = [];
    for await (const v of stream) out.push(v);

    // Valid JSON should be parsed, invalid JSON should fall through as raw strings
    expect(out).toEqual([
      { valid: "json" },
      '{"invalid": json, missing: quotes}', // Falls through due to JSON.parse error
      { another: "valid" },
      "just a regular string",
      '{"malformed": "json",}', // Falls through due to JSON.parse error (trailing comma)
    ]);
  });

  test("handles mixed valid JSON, invalid JSON, and non-JSON strings", async () => {
    const transformer = createSseTransformer();

    const sseBody = [
      'data: {"valid": "object"}\n\n',
      'data: ["valid", "array"]\n\n',
      'data: {"incomplete": "object"\n\n', // Missing closing brace
      "data: [incomplete array\n\n", // Invalid array syntax
      "data: plain text message\n\n",
      'data: {"another": "valid", "object": true}\n\n',
    ].join("");

    const response = new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });

    const ctx = makeCtx({
      response: { raw: response },
    });

    await transformer(ctx);

    const stream = ctx.response.data as AsyncIterable<unknown>;
    const out: unknown[] = [];
    for await (const v of stream) out.push(v);

    expect(out).toEqual([
      { valid: "object" },
      ["valid", "array"],
      '{"incomplete": "object"', // Falls through - invalid JSON
      "[incomplete array", // Falls through - invalid JSON
      "plain text message",
      { another: "valid", object: true },
    ]);
  });

  test("normalizes CRLF delimiters between events", async () => {
    const transformer = createSseTransformer();

    const sseBody = ['data: {"a":1}\r\n\r\n', 'data: {"b":2}\r\n\r\n'].join("");

    const response = new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });

    const ctx = makeCtx({
      response: { raw: response },
    });

    await transformer(ctx);

    const stream = ctx.response.data as AsyncIterable<unknown>;
    const out: unknown[] = [];
    for await (const v of stream) out.push(v);

    expect(out).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

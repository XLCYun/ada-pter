import { describe, expect, test } from "bun:test";
import {
  jsonTransformer,
  sseTransformer,
} from "../../../ada-pter/src/transformers";
import { autoProvider } from "../src/completion";

describe("@ada-pter/openai completion", () => {
  test("autoProvider.getHandler returns null for unsupported apiType", () => {
    const ctx = {
      apiType: "not-exists-api",
      config: { stream: false },
    } as any;

    expect(autoProvider.getHandler(ctx)).toBeNull();
  });

  test("autoProvider.getHandler returns json handler when stream=false", () => {
    const ctx = {
      apiType: "completion",
      config: { stream: false },
    } as any;

    const handler = autoProvider.getHandler(ctx);
    expect(handler).not.toBeNull();
    expect(handler!.responseTransformers).toEqual([jsonTransformer]);
  });

  test("autoProvider.getHandler returns sse parser when stream=true", () => {
    const ctx = {
      apiType: "completion",
      config: { stream: true },
    } as any;

    const handler = autoProvider.getHandler(ctx);
    expect(handler).not.toBeNull();
    expect(handler!.responseTransformers).toEqual([sseTransformer]);
  });

  test("getRequestConfig builds url, headers, and body with defaults", () => {
    const ctx = {
      apiType: "completion",
      modelId: "openai/gpt-4.1-mini",
      providerKey: "openai",
      model: "gpt-4.1-mini",
      normModel: "gpt-4.1-mini",
      normProvider: "openai",
      normModelId: "openai/gpt-4.1-mini",
      request: {},
      response: {},
      state: {},
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        // apiPath not provided => default /chat/completions
        stream: false,
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.2,
      },
    } as any;

    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://example.com/v1/chat/completions");

    const headers = req.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer sk-test");
    expect(headers.get("Content-Type")).toBe("application/json");

    expect(req.body).toEqual({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "hi" }],
      audio: undefined,
      functions: undefined,
      function_call: undefined,
      logit_bias: undefined,
      logprobs: undefined,
      max_completion_tokens: undefined,
      max_tokens: undefined,
      metadata: undefined,
      modalities: undefined,
      n: undefined,
      parallel_tool_calls: undefined,
      prediction: undefined,
      presence_penalty: undefined,
      prompt_cache_key: undefined,
      prompt_cache_retention: undefined,
      reasoning_effort: undefined,
      response_format: undefined,
      safety_identifier: undefined,
      seed: undefined,
      service_tier: undefined,
      stop: undefined,
      store: undefined,
      stream: false,
      stream_options: undefined,
      temperature: 0.2,
      tool_choice: undefined,
      tools: undefined,
      top_logprobs: undefined,
      top_p: undefined,
      user: undefined,
      verbosity: undefined,
      web_search_options: undefined,
    } as any);
  });

  test("getRequestConfig respects apiPath override", () => {
    const ctx = {
      apiType: "completion",
      modelId: "openai/gpt-4",
      providerKey: "openai",
      model: "gpt-4",
      normModel: "gpt-4",
      normProvider: "openai",
      normModelId: "openai/gpt-4",
      request: {},
      response: {},
      state: {},
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        apiPath: "/custom/path",
        stream: false,
        messages: [],
      },
    } as any;

    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.url).toBe("https://example.com/v1/custom/path");
  });

  test("getRequestConfig uses default openai base and completion path", () => {
    const ctx = {
      apiType: "completion",
      modelId: "openai/gpt-4",
      providerKey: "openai",
      model: "gpt-4",
      normModel: "gpt-4",
      normProvider: "openai",
      normModelId: "openai/gpt-4",
      request: {},
      response: {},
      state: {},
      config: {
        apiKey: "sk-test",
        // apiBase/apiPath intentionally undefined to rely on defaults
        stream: false,
        messages: [],
      },
    } as any;

    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.url).toBe("https://api.openai.com/v1/chat/completions");
  });

  test("getRequestConfig throws when base and path are missing", () => {
    const ctx = {
      apiType: "completion",
      modelId: "openai/gpt-4",
      providerKey: "openai",
      model: "gpt-4",
      normModel: "gpt-4",
      normProvider: "openai",
      normModelId: "openai/gpt-4",
      request: {},
      response: {},
      state: {},
      config: {
        apiKey: "sk-test",
        apiBase: "",
        apiPath: "",
        stream: false,
        messages: [],
      },
    } as any;

    const handler = autoProvider.getHandler(ctx)!;

    expect(() => handler.getRequestConfig(ctx)).toThrow(
      "No base URL or path provided",
    );
  });
});

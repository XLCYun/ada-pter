import { describe, expect, test } from "bun:test";
import { jsonTransformer } from "../../../ada-pter/src/transformers";
import { autoProvider } from "../src/completion";

const baseCtx = {
  modelId: "openai/text-embedding-3-small",
  providerKey: "openai",
  model: "text-embedding-3-small",
  normModel: "text-embedding-3-small",
  normProvider: "openai",
  normModelId: "openai/text-embedding-3-small",
  request: {},
  response: {},
  state: {},
} as const;

describe("@ada-pter/openai embedding", () => {
  test("autoProvider.getHandler returns embedding handler", () => {
    const handler = autoProvider.getHandler({
      ...baseCtx,
      apiType: "embedding",
      config: { stream: false },
    } as any);

    expect(handler).not.toBeNull();
    expect(handler!.responseTransformers).toEqual([jsonTransformer]);
  });

  test("getRequestConfig builds url, headers, and body", () => {
    const ctx = {
      ...baseCtx,
      apiType: "embedding",
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        input: "hello",
        dimensions: 256,
        encoding_format: "float",
        user: "user-123",
      },
    } as any;

    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://example.com/v1/embeddings");

    const headers = req.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer sk-test");
    expect(headers.get("Content-Type")).toBe("application/json");

    expect(req.body).toEqual({
      input: "hello",
      model: "text-embedding-3-small",
      dimensions: 256,
      encoding_format: "float",
      user: "user-123",
    } as any);
  });

  test("getRequestConfig respects apiPath override", () => {
    const ctx = {
      ...baseCtx,
      apiType: "embedding",
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        apiPath: "/custom/embeddings",
        input: "world",
      },
    } as any;

    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.url).toBe("https://example.com/v1/custom/embeddings");
  });

  test("getRequestConfig uses default openai base and embeddings path", () => {
    const ctx = {
      ...baseCtx,
      apiType: "embedding",
      config: {
        apiKey: "sk-test",
        input: "hi",
      },
    } as any;

    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.url).toBe("https://api.openai.com/v1/embeddings");
  });
});

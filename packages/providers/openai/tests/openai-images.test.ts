import { describe, expect, test } from "bun:test";
import {
  jsonTransformer,
  sseTransformer,
} from "../../../ada-pter/src/transformers";
import { autoProvider } from "../src/completion";

function createCtx(stream: boolean) {
  return {
    apiType: "image.generation",
    model: "gpt-image-1",
    normModel: "gpt-image-1",
    providerKey: "openai",
    normProvider: "openai",
    modelId: "openai/gpt-image-1",
    normModelId: "openai/gpt-image-1",
    request: {},
    response: {},
    state: {},
    config: {
      apiKey: "sk-test",
      apiBase: "https://example.com/v1",
      stream,
      prompt: "draw a cat",
    },
  } as any;
}

describe("@ada-pter/openai images", () => {
  test("autoProvider.getHandler returns json handler when stream=false", () => {
    const ctx = createCtx(false);
    const handler = autoProvider.getHandler(ctx);
    expect(handler).not.toBeNull();
    expect(handler!.responseTransformers).toEqual([jsonTransformer]);
  });

  test("autoProvider.getHandler returns sse handler when stream=true", () => {
    const ctx = createCtx(true);
    const handler = autoProvider.getHandler(ctx);
    expect(handler).not.toBeNull();
    expect(handler!.responseTransformers).toEqual([sseTransformer]);
  });

  test("getRequestConfig builds url, headers, and body with defaults", () => {
    const ctx = createCtx(false);
    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://example.com/v1/images/generations");

    const headers = req.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer sk-test");
    expect(headers.get("Content-Type")).toBe("application/json");

    expect(req.body).toEqual({
      prompt: "draw a cat",
      model: "gpt-image-1",
      background: undefined,
      moderation: undefined,
      n: undefined,
      output_compression: undefined,
      output_format: undefined,
      partial_images: undefined,
      quality: undefined,
      response_format: undefined,
      size: undefined,
      stream: false,
      style: undefined,
      user: undefined,
    } as any);
  });

  test("getRequestConfig respects apiPath override", () => {
    const ctx = createCtx(false);
    ctx.config.apiPath = "/custom/images";

    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.url).toBe("https://example.com/v1/custom/images");
  });
});

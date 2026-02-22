import { describe, expect, test } from "bun:test";
import {
  arrayBufferTransformer,
  sseTransformer,
} from "../../../ada-pter/src/transformers";
import { autoProvider } from "../src/completion";

const baseCtx = {
  modelId: "openai/tts-1",
  providerKey: "openai",
  model: "tts-1",
  normModel: "tts-1",
  normProvider: "openai",
  normModelId: "openai/tts-1",
  request: {},
  response: {},
  state: {},
} as any;

const baseConfig = {
  apiKey: "sk-test",
  apiBase: "https://example.com/v1",
};

describe("@ada-pter/openai speech", () => {
  test("returns arrayBuffer transformer when stream=false", () => {
    const ctx = {
      ...baseCtx,
      apiType: "speech",
      config: {
        ...baseConfig,
        stream: false,
        input: "hello",
        voice: "alloy",
        response_format: "mp3",
      },
    } as any;

    const handler = autoProvider.getHandler(ctx);
    expect(handler).not.toBeNull();
    expect(handler!.responseTransformers).toEqual([arrayBufferTransformer]);
  });

  test("returns sse transformer when stream=true", () => {
    const ctx = {
      ...baseCtx,
      apiType: "speech",
      config: {
        ...baseConfig,
        stream: true,
        input: "hello",
        voice: "alloy",
      },
    } as any;

    const handler = autoProvider.getHandler(ctx);
    expect(handler).not.toBeNull();
    expect(handler!.responseTransformers).toEqual([sseTransformer]);
  });

  test("getRequestConfig builds url/headers/body with auto stream_format (audio)", () => {
    const ctx = {
      ...baseCtx,
      apiType: "speech",
      config: {
        ...baseConfig,
        stream: false,
        input: "hello",
        voice: "alloy",
        response_format: "mp3",
      },
    } as any;

    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://example.com/v1/audio/speech");

    const headers = req.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer sk-test");
    expect(headers.get("Content-Type")).toBe("application/json");

    expect(req.body).toEqual({
      input: "hello",
      model: "tts-1",
      voice: "alloy",
      instructions: undefined,
      response_format: "mp3",
      speed: undefined,
      stream_format: "audio",
    } as any);
  });

  test("getRequestConfig builds body with auto stream_format (sse) when stream=true", () => {
    const ctx = {
      ...baseCtx,
      apiType: "speech",
      config: {
        ...baseConfig,
        stream: true,
        input: "hello",
        voice: "alloy",
      },
    } as any;

    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.body).toEqual({
      input: "hello",
      model: "tts-1",
      voice: "alloy",
      instructions: undefined,
      response_format: undefined,
      speed: undefined,
      stream_format: "sse",
    } as any);
  });
});

import { describe, expect, test } from "bun:test";
import {
  jsonTransformer,
  sseTransformer,
} from "../../../ada-pter/src/transformers";
import { autoProvider } from "../src/completion";

describe("@ada-pter/openai responses", () => {
  const baseCtx = {
    modelId: "openai/gpt-4.1-mini",
    providerKey: "openai",
    model: "gpt-4.1-mini",
    normModel: "gpt-4.1-mini",
    normProvider: "openai",
    normModelId: "openai/gpt-4.1-mini",
    request: {},
    response: {},
    state: {},
  } as const;

  test("autoProvider.getHandler returns handler for all response apiTypes", () => {
    const apiTypes = [
      "response.create",
      "response.cancel",
      "response.delete",
      "response.compact",
      "response.retrieve",
      "response.input_items.list",
    ] as const;

    for (const apiType of apiTypes) {
      const handler = autoProvider.getHandler({
        ...baseCtx,
        apiType,
        config: { stream: false },
      } as any);
      expect(handler).not.toBeNull();
    }
  });

  test("response.create uses json/sse transformer by stream flag", () => {
    const nonStream = autoProvider.getHandler({
      ...baseCtx,
      apiType: "response.create",
      config: { stream: false },
    } as any);
    expect(nonStream!.responseTransformers).toEqual([jsonTransformer]);

    const stream = autoProvider.getHandler({
      ...baseCtx,
      apiType: "response.create",
      config: { stream: true },
    } as any);
    expect(stream!.responseTransformers).toEqual([sseTransformer]);
  });

  test("response.retrieve uses json/sse transformer by stream flag", () => {
    const nonStream = autoProvider.getHandler({
      ...baseCtx,
      apiType: "response.retrieve",
      config: { stream: false },
    } as any);
    expect(nonStream!.responseTransformers).toEqual([jsonTransformer]);

    const stream = autoProvider.getHandler({
      ...baseCtx,
      apiType: "response.retrieve",
      config: { stream: true },
    } as any);
    expect(stream!.responseTransformers).toEqual([sseTransformer]);
  });

  test("response.create getRequestConfig builds POST /responses request", () => {
    const ctx = {
      ...baseCtx,
      apiType: "response.create",
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        model: "gpt-4.1-mini",
        input: "Reply with pong",
        stream: false,
      },
    } as any;

    const req = autoProvider.getHandler(ctx)!.getRequestConfig(ctx);
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://example.com/v1/responses");

    const headers = req.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer sk-test");
    expect(headers.get("Content-Type")).toBe("application/json");

    expect(req.body).toEqual(
      expect.objectContaining({
        model: "gpt-4.1-mini",
        input: "Reply with pong",
        stream: false,
      }),
    );
  });

  test("response.retrieve getRequestConfig builds GET /responses/{id} with query", () => {
    const ctx = {
      ...baseCtx,
      apiType: "response.retrieve",
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        response_id: "resp_123",
        include: ["output_text"],
        include_obfuscation: true,
        starting_after: "item_1",
        stream: true,
      },
    } as any;

    const req = autoProvider.getHandler(ctx)!.getRequestConfig(ctx);
    expect(req.method).toBe("GET");
    expect(req.url).toContain("https://example.com/v1/responses/resp_123?");
    expect(req.url).toContain("include=output_text");
    expect(req.url).toContain("include_obfuscation=true");
    expect(req.url).toContain("starting_after=item_1");
    expect(req.url).toContain("stream=true");
  });

  test("cancel/delete/compact/list-input-items request mapping is correct", () => {
    const cancelCtx = {
      ...baseCtx,
      apiType: "response.cancel",
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        response_id: "resp_1",
      },
    } as any;
    const cancelReq = autoProvider.getHandler(cancelCtx)!.getRequestConfig(cancelCtx);
    expect(cancelReq.method).toBe("POST");
    expect(cancelReq.url).toBe("https://example.com/v1/responses/resp_1/cancel");

    const deleteCtx = {
      ...baseCtx,
      apiType: "response.delete",
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        response_id: "resp_2",
      },
    } as any;
    const deleteReq = autoProvider.getHandler(deleteCtx)!.getRequestConfig(deleteCtx);
    expect(deleteReq.method).toBe("DELETE");
    expect(deleteReq.url).toBe("https://example.com/v1/responses/resp_2");

    const compactCtx = {
      ...baseCtx,
      apiType: "response.compact",
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        model: "gpt-4.1-mini",
        reason: "cleanup",
      },
    } as any;
    const compactReq = autoProvider.getHandler(compactCtx)!.getRequestConfig(compactCtx);
    expect(compactReq.method).toBe("POST");
    expect(compactReq.url).toBe("https://example.com/v1/responses/compact");
    expect(compactReq.body).toEqual(compactCtx.config);

    const listCtx = {
      ...baseCtx,
      apiType: "response.input_items.list",
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        response_id: "resp_3",
        include: ["input_text"],
        order: "asc",
        after: "item_0",
        limit: 5,
      },
    } as any;
    const listReq = autoProvider.getHandler(listCtx)!.getRequestConfig(listCtx);
    expect(listReq.method).toBe("GET");
    expect(listReq.url).toContain("https://example.com/v1/responses/resp_3/input_items?");
    expect(listReq.url).toContain("include=input_text");
    expect(listReq.url).toContain("order=asc");
    expect(listReq.url).toContain("after=item_0");
    expect(listReq.url).toContain("limit=5");
  });

  test("responses handlers respect apiPath override", () => {
    const createCtx = {
      ...baseCtx,
      apiType: "response.create",
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        apiPath: "/custom/responses",
        model: "gpt-4.1-mini",
        input: "hi",
      },
    } as any;
    const createReq = autoProvider.getHandler(createCtx)!.getRequestConfig(createCtx);
    expect(createReq.url).toBe("https://example.com/v1/custom/responses");

    const retrieveCtx = {
      ...baseCtx,
      apiType: "response.retrieve",
      config: {
        apiKey: "sk-test",
        apiBase: "https://example.com/v1",
        apiPath: "/custom/retrieve",
        response_id: "resp_9",
      },
    } as any;
    const retrieveReq = autoProvider
      .getHandler(retrieveCtx)!
      .getRequestConfig(retrieveCtx);
    expect(retrieveReq.url).toBe("https://example.com/v1/custom/retrieve");
  });
});

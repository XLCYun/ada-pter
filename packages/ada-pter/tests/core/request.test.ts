/// <reference path="../bun-test.d.ts" />

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createRequestMiddleware } from "../../src/core/request";
import { TimeoutError } from "../../src/errors";
import type { AdapterContext } from "../../src/types/core";
import type { ApiHandler, Provider } from "../../src/types/provider";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeHandler(opts: { response?: unknown } = {}): ApiHandler {
  return {
    getRequestConfig: (ctx) => ({
      url: "https://api.test.com/v1/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ model: ctx.model, messages: ctx.config.messages }),
    }),
    responseTransformers: [
      async (ctx) => {
        const res = ctx.response.raw;
        if (!res) throw new Error("missing raw response");
        const raw = await res.json();
        ctx.response.data = opts.response ?? raw;
      },
    ],
  };
}

function makeProvider(name: string, handler?: ApiHandler | null): Provider {
  const h = handler === undefined ? makeHandler() : handler;
  return {
    name,
    getHandler: () => h,
  };
}

/**
 * Create a fully-resolved context (as createContext would produce).
 * ctx.request is already populated (as it would be after handler.getRequestConfig() merge).
 */
function makeCtx(overrides: Partial<AdapterContext> = {}): AdapterContext {
  const provider = overrides.provider ?? makeProvider("test");
  const handler =
    overrides.handler ?? provider.getHandler({} as AdapterContext) ?? undefined;
  const model = overrides.model ?? "gpt-4";
  const providerKey = overrides.providerKey ?? "test";
  const normModel = overrides.normModel ?? model.toLowerCase();
  const normProvider = overrides.normProvider ?? providerKey.toLowerCase();
  const modelId = overrides.modelId ?? `${providerKey}/${model}`;
  const normModelId = overrides.normModelId ?? `${normProvider}/${normModel}`;
  return {
    apiType: "completion",
    config: { messages: [] },
    state: {},
    modelId,
    providerKey,
    model,
    normModel,
    normProvider,
    normModelId,
    provider,
    handler,
    request: {
      url: "https://api.test.com/v1/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ model: "gpt-4", messages: [] }),
    },
    response: {},
    ...overrides,
  };
}

const mockFetch = mock(() =>
  Promise.resolve(
    new Response(JSON.stringify({ id: "1", model: "gpt-4", choices: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ),
);

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockClear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ─── Execution ──────────────────────────────────────────────────────────────

describe("request middleware: execution", () => {
  test("uses ctx.request url and init for fetch", async () => {
    const mw = createRequestMiddleware();
    const ctx = makeCtx();

    await mw(ctx, async () => {});

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0] as unknown[];
    expect(callArgs[0]).toBe("https://api.test.com/v1/completions");
    const init = callArgs[1] as RequestInit;
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer test-key");
  });

  test("saves raw Response to ctx.response.raw", async () => {
    const mw = createRequestMiddleware();
    const ctx = makeCtx();

    await mw(ctx, async () => {});

    expect(ctx.response.raw).toBeInstanceOf(Response);
    const res = ctx.response.raw;
    if (!res) throw new Error("missing raw response");
    expect(res.status).toBe(200);
  });

  test("executes responseTransformers and stores result in ctx.response.data", async () => {
    const transformedResponse = { id: "transformed", choices: ["a"] };
    const handler = makeHandler({ response: transformedResponse });
    const provider = makeProvider("test", handler);
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider, handler });

    await mw(ctx, async () => {});

    expect(ctx.response.data).toEqual(transformedResponse);
  });

  test("executes multiple responseTransformers sequentially", async () => {
    const order: string[] = [];
    const handler: ApiHandler = {
      getRequestConfig: () => ({
        url: "https://api.test.com/v1/completions",
        method: "POST",
      }),
      responseTransformers: [
        async () => {
          order.push("first");
          await Promise.resolve();
        },
        async (ctx) => {
          order.push("second");
          ctx.response.data = { ok: true };
        },
      ],
    };
    const provider = makeProvider("test", handler);
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider, handler });

    await mw(ctx, async () => {});

    expect(order).toEqual(["first", "second"]);
    expect(ctx.response.data).toEqual({ ok: true });
  });

  test("propagates transformer errors and halts pipeline", async () => {
    const err = new Error("transformer failed");
    const spy = mock(() => Promise.resolve());
    const handler: ApiHandler = {
      getRequestConfig: () => ({
        url: "https://api.test.com/v1/completions",
        method: "POST",
      }),
      responseTransformers: [
        async () => {
          throw err;
        },
        async () => {
          await spy();
        },
      ],
    };
    const provider = makeProvider("test", handler);
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider, handler });

    await expect(mw(ctx, async () => {})).rejects.toBe(err);
    expect(spy).not.toHaveBeenCalled();
  });

  test("propagates async transformer rejections", async () => {
    const err = new Error("async transformer failed");
    const spy = mock(() => Promise.resolve());
    const handler: ApiHandler = {
      getRequestConfig: () => ({
        url: "https://api.test.com/v1/completions",
        method: "POST",
      }),
      responseTransformers: [
        async () => {
          await Promise.reject(err);
        },
        async () => {
          await spy();
        },
      ],
    };
    const provider = makeProvider("test", handler);
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider, handler });

    await expect(mw(ctx, async () => {})).rejects.toBe(err);
    expect(spy).not.toHaveBeenCalled();
  });

  test("transformers can mutate ctx between stages", async () => {
    const handler: ApiHandler = {
      getRequestConfig: () => ({
        url: "https://api.test.com/v1/completions",
        method: "POST",
      }),
      responseTransformers: [
        async (ctx) => {
          ctx.state.duration = 42;
        },
        async (ctx) => {
          ctx.response.data = { duration: ctx.state.duration };
        },
      ],
    };
    const provider = makeProvider("test", handler);
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider, handler, state: {} });

    await mw(ctx, async () => {});

    expect(ctx.response.data).toEqual({ duration: 42 });
  });

  test("uses default jsonTransformer when handler.responseTransformers is empty", async () => {
    const handler: ApiHandler = {
      getRequestConfig: () => ({
        url: "https://api.test.com/v1/completions",
        method: "POST",
      }),
      responseTransformers: [],
    };
    const provider = makeProvider("test", handler);
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider, handler });

    await mw(ctx, async () => {});

    expect(ctx.response.data).toEqual({ id: "1", model: "gpt-4", choices: [] });
  });

  test("uses default sseTransformer when handler.responseTransformers is empty", async () => {
    const sseBody = ['data: {"a":1}\n\n', "data: hello\n\n"].join("");

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(sseBody, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const handler: ApiHandler = {
      getRequestConfig: () => ({
        url: "https://api.test.com/v1/completions",
        method: "POST",
      }),
      responseTransformers: [],
    };
    const provider = makeProvider("test", handler);
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider, handler });

    await mw(ctx, async () => {});

    const stream = ctx.response.data as AsyncIterable<unknown>;
    const out: unknown[] = [];
    for await (const v of stream) out.push(v);
    expect(out).toEqual([{ a: 1 }, "hello"]);
  });

  test("default sseTransformer stops on [DONE] marker", async () => {
    const sseBody = [
      'data: {"a":1}\n\n',
      "data: [DONE]\n\n",
      "data: should-not-appear\n\n",
    ].join("");

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(sseBody, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const handler: ApiHandler = {
      getRequestConfig: () => ({
        url: "https://api.test.com/v1/completions",
        method: "POST",
      }),
      responseTransformers: [],
    };
    const provider = makeProvider("test", handler);
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider, handler });

    await mw(ctx, async () => {});

    const stream = ctx.response.data as AsyncIterable<unknown>;
    const out: unknown[] = [];
    for await (const v of stream) out.push(v);
    expect(out).toEqual([{ a: 1 }]);
  });

  test("default transformers no-op for non-json and non-sse", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        new Response("ok", {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        }),
      ),
    );

    const handler: ApiHandler = {
      getRequestConfig: () => ({
        url: "https://api.test.com/v1/completions",
        method: "POST",
      }),
      responseTransformers: [],
    };
    const provider = makeProvider("test", handler);
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider, handler });

    await mw(ctx, async () => {});

    expect(ctx.response.data).toBeUndefined();
  });

  test("non-ok fetch throws ProviderError", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(new Response("Rate limit exceeded", { status: 429 })),
    );

    const provider = makeProvider("openai");
    const handler = provider.getHandler({} as AdapterContext) ?? undefined;
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider, handler });

    const err = await mw(ctx, async () => {}).catch((e) => e);
    expect(err.name).toBe("ProviderError");
    expect(err.status).toBe(429);
    expect(err.provider).toBe("openai");
    expect(err.body).toBe("Rate limit exceeded");
    expect(err.message).toContain("[openai] HTTP 429: Rate limit exceeded");
  });

  test("non-ok fetch falls back to 'unknown' provider name", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(new Response("auth required", { status: 401 })),
    );

    const mw = createRequestMiddleware();
    const ctx = makeCtx({ provider: undefined, handler: undefined });

    const err = await mw(ctx, async () => {}).catch((e) => e);
    expect(err.provider).toBe("unknown");
    expect(err.status).toBe(401);
    expect(err.body).toBe("auth required");
  });

  test("throws when handler is missing", async () => {
    const mw = createRequestMiddleware();
    const ctx = makeCtx({ handler: undefined });

    await expect(mw(ctx, async () => {})).rejects.toThrow(
      "[request] no handler found",
    );
  });

  test("propagates fetch rejection errors", async () => {
    const networkErr = new Error("network down");
    mockFetch.mockImplementationOnce(() => Promise.reject(networkErr));

    const mw = createRequestMiddleware();
    const ctx = makeCtx();

    await expect(mw(ctx, async () => {})).rejects.toBe(networkErr);
    expect(ctx.response.raw).toBeUndefined();
  });

  test("translates timeout abort into TimeoutError when signal timed out", async () => {
    const abortErr = new DOMException(
      "The operation was aborted.",
      "AbortError",
    );
    mockFetch.mockImplementationOnce(() => Promise.reject(abortErr));

    const mw = createRequestMiddleware();
    const timeoutMs = 1234;
    const controller = new AbortController();
    controller.abort(new DOMException("timed out", "TimeoutError"));

    const ctx = makeCtx({
      config: { timeout: timeoutMs },
      signal: controller.signal,
    });

    const err = await mw(ctx, async () => {}).catch((e) => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.timeout).toBe(timeoutMs);
  });

  test("preserves non-timeout abort reasons", async () => {
    const abortErr = new DOMException(
      "The operation was aborted.",
      "AbortError",
    );
    mockFetch.mockImplementationOnce(() => Promise.reject(abortErr));

    const mw = createRequestMiddleware();
    const controller = new AbortController();
    controller.abort(new DOMException("user cancel", "AbortError"));

    const ctx = makeCtx({
      config: {},
      signal: controller.signal,
    });

    await expect(mw(ctx, async () => {})).rejects.toBe(abortErr);
  });

  test("non-ok fetch still saves raw Response to ctx.response.raw", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(new Response("Rate limit exceeded", { status: 429 })),
    );

    const mw = createRequestMiddleware();
    const ctx = makeCtx();

    await mw(ctx, async () => {}).catch(() => {});

    expect(ctx.response.raw).toBeInstanceOf(Response);
    const res = ctx.response.raw;
    if (!res) throw new Error("missing raw response");
    expect(res.status).toBe(429);
  });

  test("signal in ctx.request is passed to fetch", async () => {
    const controller = new AbortController();
    const provider = makeProvider("openai");
    const handler = provider.getHandler({} as AdapterContext) ?? undefined;
    const mw = createRequestMiddleware();
    const ctx = makeCtx({
      provider,
      handler,
      request: {
        url: "https://api.test.com/v1/completions",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4" }),
        signal: controller.signal,
      },
    });

    await mw(ctx, async () => {});

    const callArgs = mockFetch.mock.calls[0] as unknown[];
    const init = callArgs[1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });

  test("passes through all RequestInit fields", async () => {
    const mw = createRequestMiddleware();
    const ctx = makeCtx({
      request: {
        url: "https://api.test.com/v1/completions",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4" }),
        cache: "no-store",
        credentials: "include",
        mode: "cors",
        redirect: "follow",
        referrerPolicy: "strict-origin",
      },
    });

    await mw(ctx, async () => {});

    const callArgs = mockFetch.mock.calls[0] as unknown[];
    const init = callArgs[1] as RequestInit;
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("include");
    expect(init.mode).toBe("cors");
    expect(init.redirect).toBe("follow");
    expect(init.referrerPolicy).toBe("strict-origin");
  });

  test("allows null request body", async () => {
    const mw = createRequestMiddleware();
    const ctx = makeCtx({
      request: {
        url: "https://api.test.com/v1/completions",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: null,
      },
    });

    await mw(ctx, async () => {});

    const callArgs = mockFetch.mock.calls[0] as unknown[];
    const init = callArgs[1] as RequestInit;
    expect(init.body).toBeNull();
  });
});

/// <reference path="../bun-test.d.ts" />
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { AdaPter, adapter, createAdapter } from "../../src/core/adapter";
import { autoLoader } from "../../src/core/auto-loader";
import {
  InvalidModelError,
  NoProviderError,
  UnsupportedApiError,
} from "../../src/errors";
import type { StreamChunk } from "../../src/types";
import type { Middleware } from "../../src/types/core";
import type { ApiHandler, Provider } from "../../src/types/provider";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeHandler(
  response: unknown = { id: "1", model: "test", choices: [], usage: null },
): ApiHandler {
  return {
    getRequestConfig: (ctx) => ({
      url: "https://api.test.com/v1/completions",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ctx.model,
        messages: ctx.config.messages,
      }),
    }),
    responseTransformers: [
      async (ctx) => {
        ctx.response.data = response;
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

function makeStream<T>(chunks: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

// Mock fetch globally
const defaultFetchImpl = () =>
  Promise.resolve(
    new Response(JSON.stringify({ id: "1", model: "test", choices: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

const mockFetch = mock(defaultFetchImpl);

beforeEach(() => {
  globalThis.fetch = mockFetch as any;
  mockFetch.mockClear();
  mockFetch.mockImplementation(defaultFetchImpl);
});

// ─── Streaming ───────────────────────────────────────────────────────────────

describe("streaming completions", () => {
  test("returns async iterable when stream flag is true", async () => {
    const chunks = [{ id: "chunk-1" }, { id: "chunk-2" }];
    const streamHandler = makeHandler(makeStream(chunks));
    const prov = makeProvider("stream", streamHandler);

    const a = createAdapter().route({ model: /.*/ }, prov);

    const streamResult = a.completion({
      model: "stream-model",
      messages: [],
      stream: true,
    });
    const stream = streamResult as AsyncIterable<StreamChunk>;

    const received: StreamChunk[] = [];
    for await (const chunk of stream) {
      received.push(chunk);
    }

    expect(received).toEqual(chunks);
  });

  test("streaming still honors model fallback when context creation fails", async () => {
    const failingHandler: ApiHandler = {
      getRequestConfig() {
        throw new Error("cannot build request");
      },
      responseTransformers: [],
    };
    const fallbackHandler = makeHandler(makeStream([{ id: "chunk" }]));

    const failingProv = makeProvider("fail", failingHandler);
    const fallbackProv = makeProvider("ok", fallbackHandler);

    const a = createAdapter()
      .route({ model: /^fail/ }, failingProv)
      .route({ model: /.*/ }, fallbackProv);

    const streamResult = a.completion({
      model: ["fail-model", "good-model"],
      messages: [],
      stream: true,
    });
    const stream = streamResult as AsyncIterable<StreamChunk>;

    const collected: StreamChunk[] = [];
    for await (const chunk of stream) {
      collected.push(chunk);
    }

    expect(collected).toEqual([{ id: "chunk" }]);
  });
});

afterEach(() => {
  mockFetch.mockClear();
  mockFetch.mockImplementation(defaultFetchImpl);
});

// ─── use() ─────────────────────────────────────────────────────────────────

describe("use()", () => {
  test("registers middleware functions", async () => {
    const order: string[] = [];
    const mw1: Middleware = async (_, next) => {
      order.push("mw1-before");
      await next();
      order.push("mw1-after");
    };
    const mw2: Middleware = async (_, next) => {
      order.push("mw2-before");
      await next();
      order.push("mw2-after");
    };

    const a = createAdapter()
      .use(mw1)
      .use(mw2)
      .route({ model: /.*/ }, makeProvider("test"));

    await a.completion({ model: "test-model", messages: [] });

    expect(order).toEqual([
      "mw1-before",
      "mw2-before",
      "mw2-after",
      "mw1-after",
    ]);
  });

  test("returns this for chaining", () => {
    const a = new AdaPter();
    const result = a.use(async (_, next) => next());
    expect(result).toBe(a);
  });
});

// ─── route() ───────────────────────────────────────────────────────────────

describe("route()", () => {
  test("condition route with model pattern", async () => {
    const openai = makeProvider("openai");
    const a = createAdapter().route({ model: /^gpt-/ }, openai);

    const res = await a.completion({ model: "gpt-4", messages: [] });
    expect(res).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("condition route with provider prefix", async () => {
    const openai = makeProvider("openai");
    const a = createAdapter().route({ provider: "openai" }, openai);

    const res = await a.completion({ model: "openai/gpt-4", messages: [] });
    expect(res).toBeDefined();
  });

  test("condition route with modelId", async () => {
    const openai = makeProvider("openai");
    const a = createAdapter().route({ modelId: /^openai\/gpt-/ }, openai);

    const res = await a.completion({ model: "openai/gpt-4", messages: [] });
    expect(res).toBeDefined();
  });

  test("resolver route (function)", async () => {
    const prov = makeProvider("custom");
    const a = createAdapter().route((ctx) => {
      if (ctx.model === "custom-model") return prov;
      return null;
    });

    // This should fail for gpt-4 (no match), so add a fallback
    const openai = makeProvider("openai");
    a.route({ model: /^gpt-/ }, openai);

    const res = await a.completion({ model: "custom-model", messages: [] });
    expect(res).toBeDefined();
  });

  test("route chain respects order (first match wins)", async () => {
    const first = makeProvider("first", makeHandler({ id: "first" }));
    const second = makeProvider("second", makeHandler({ id: "second" }));

    const a = createAdapter()
      .route({ model: /^gpt-/ }, first)
      .route({ model: /^gpt-/ }, second);

    const res = await a.completion({ model: "gpt-4", messages: [] });
    expect(res).toEqual({ id: "first" });
  });

  test("no matching route -> NoProviderError", async () => {
    const a = createAdapter().route(
      { model: /^claude-/ },
      makeProvider("anthropic"),
    );

    await expect(
      a.completion({ model: "gpt-4", messages: [] }),
    ).rejects.toBeInstanceOf(NoProviderError);
  });

  test("route match but getHandler returns null -> UnsupportedApiError", async () => {
    const prov = makeProvider("openai", null);
    const a = createAdapter().route({ model: "gpt-4" }, prov);

    await expect(
      a.completion({ model: "gpt-4", messages: [] }),
    ).rejects.toBeInstanceOf(UnsupportedApiError);
  });

  test("invalid model id throws InvalidModelError", async () => {
    const a = createAdapter().route({ model: /.*/ }, makeProvider("test"));

    await expect(
      a.completion({ model: "/gpt-4", messages: [] }),
    ).rejects.toBeInstanceOf(InvalidModelError);

    await expect(
      a.completion({ model: "openai//gpt-4", messages: [] }),
    ).rejects.toBeInstanceOf(InvalidModelError);
  });

  test("returns this for chaining", () => {
    const a = new AdaPter();
    const result = a.route({ model: "test" }, makeProvider("test"));
    expect(result).toBe(a);
  });
});

// ─── autoRoute() ───────────────────────────────────────────────────────────

describe("autoRoute()", () => {
  test("returns this for chaining", () => {
    const a = new AdaPter();
    const result = a.autoRoute();
    expect(result).toBe(a);
  });

  test("auto route resolves provider via autoLoader", async () => {
    const provider = makeProvider("auto");
    const originalResolve = autoLoader.resolve;
    let callCount = 0;
    const resolveStub: typeof autoLoader.resolve = async () => {
      callCount += 1;
      return provider;
    };
    autoLoader.resolve = resolveStub;

    try {
      const a = createAdapter().autoRoute();
      const res = await a.completion({ model: "openai/gpt-4", messages: [] });
      expect(res).toBeDefined();
      expect(callCount).toBeGreaterThan(0);
    } finally {
      autoLoader.resolve = originalResolve;
    }
  });

  test("auto route throws when autoLoader resolves null", async () => {
    const originalResolve = autoLoader.resolve;
    let callCount = 0;
    const resolveStub: typeof autoLoader.resolve = async () => {
      callCount += 1;
      return null;
    };
    autoLoader.resolve = resolveStub;

    try {
      const a = createAdapter().autoRoute();
      await expect(
        a.completion({ model: "anthropic/claude", messages: [] }),
      ).rejects.toBeInstanceOf(NoProviderError);
      expect(callCount).toBeGreaterThan(0);
    } finally {
      autoLoader.resolve = originalResolve;
    }
  });
});

// ─── configure() ───────────────────────────────────────────────────────────

describe("configure()", () => {
  test("global config: sets model", async () => {
    const a = createAdapter()
      .configure({ model: "gpt-4" })
      .route({ model: /^gpt-/ }, makeProvider("openai"));

    // Can call without passing model
    const res = await a.completion({ messages: [] });
    expect(res).toBeDefined();
  });

  test("API-level config: sets model for specific apiType", async () => {
    const a = createAdapter()
      .configure("completion", { model: "gpt-4" })
      .route({ model: /^gpt-/ }, makeProvider("openai"));

    const res = await a.completion({ messages: [] });
    expect(res).toBeDefined();
  });

  test("call-level model overrides API-level", async () => {
    const openai = makeProvider("openai");
    const anthropic = makeProvider("anthropic");

    let resolvedModel: string | undefined;
    const a = createAdapter()
      .use(async (ctx, next) => {
        await next();
        resolvedModel = ctx.model;
      })
      .configure("completion", { model: "gpt-4" })
      .route({ model: /^gpt-/ }, openai)
      .route({ model: /^claude-/ }, anthropic);

    await a.completion({ model: "claude-3", messages: [] });
    expect(resolvedModel).toBe("claude-3");
  });

  test("deep merges global config on multiple calls", async () => {
    let capturedConfig: any;
    const a2 = createAdapter()
      .configure({ timeout: 5000 })
      .configure({ maxRetries: 2 });

    // The global config should have both fields merged
    // We'll verify via a real call
    const prov = makeProvider("test");
    a2.use(async (ctx, next) => {
      capturedConfig = { ...ctx.config };
      await next();
    });
    a2.route({ model: /.*/ }, prov);

    await a2.completion({ model: "test", messages: [] });
    expect(capturedConfig.timeout).toBe(5000);
    expect(capturedConfig.maxRetries).toBe(2);
  });

  test("returns this for chaining", () => {
    const a = new AdaPter();
    expect(a.configure({ timeout: 5000 })).toBe(a);
    expect(a.configure("completion", { model: "gpt-4" })).toBe(a);
  });
});

// ─── model fallback ────────────────────────────────────────────────────────

describe("model fallback", () => {
  test("model array: tries next model on failure", async () => {
    let callCount = 0;

    mockFetch.mockImplementation((_url: any, init: any) => {
      callCount++;
      const body = JSON.parse(init?.body ?? "{}");
      if (body.model === "bad-model") {
        return Promise.resolve(new Response("Server Error", { status: 500 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "success",
            model: body.model,
            choices: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    });

    const handler: ApiHandler = {
      getRequestConfig: (ctx) => ({
        url: "https://api.test.com/v1",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ctx.model,
          messages: ctx.config.messages,
        }),
      }),
      responseTransformers: [
        async (ctx) => {
          ctx.response.data = await ctx.response.raw!.json();
        },
      ],
    };

    const prov: Provider = {
      name: "test",
      getHandler: () => handler,
    };

    const a = createAdapter().route({ model: /.*/ }, prov);

    const res = await a.completion({
      model: ["bad-model", "good-model"],
      messages: [],
    });

    expect(callCount).toBe(2);
    expect(res).toEqual({
      id: "success",
      model: "good-model",
      choices: [],
    });
  });

  test("model array: onFallback callback is invoked", async () => {
    const fallbacks: Array<{ from: string; to: string }> = [];

    mockFetch.mockImplementation((_url: any, init: any) => {
      const body = JSON.parse(init?.body ?? "{}");
      if (body.model !== "model-c") {
        return Promise.resolve(new Response("error", { status: 500 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ id: "1", model: "model-c", choices: [] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    });

    const handler: ApiHandler = {
      getRequestConfig: (ctx) => ({
        url: "https://api.test.com/v1",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ctx.model,
          messages: ctx.config.messages,
        }),
      }),
      responseTransformers: [
        async (ctx) => {
          ctx.response.data = await ctx.response.raw!.json();
        },
      ],
    };

    const prov: Provider = {
      name: "test",
      getHandler: () => handler,
    };

    const a = createAdapter().route({ model: /.*/ }, prov);

    await a.completion({
      model: ["model-a", "model-b", "model-c"],
      messages: [],
      onFallback: (_, from, to) => fallbacks.push({ from, to }),
    });

    expect(fallbacks).toEqual([
      { from: "model-a", to: "model-b" },
      { from: "model-b", to: "model-c" },
    ]);
  });

  test("model array: all fail -> throws last error", async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve(new Response("always fails", { status: 500 }));
    });

    const handler: ApiHandler = {
      getRequestConfig: (ctx) => ({
        url: "https://api.test.com/v1",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: ctx.model }),
      }),
      responseTransformers: [
        async (ctx) => {
          ctx.response.data = await ctx.response.raw!.json();
        },
      ],
    };

    const prov: Provider = {
      name: "test",
      getHandler: () => handler,
    };

    const a = createAdapter().route({ model: /.*/ }, prov);

    await expect(
      a.completion({ model: ["m1", "m2"], messages: [] }),
    ).rejects.toThrow("always fails");
  });
});

// ─── createAdapter + singleton ─────────────────────────────────────────────

describe("createAdapter / singleton", () => {
  test("createAdapter() returns a new AdaPter instance", () => {
    const a = createAdapter();
    expect(a).toBeInstanceOf(AdaPter);
  });

  test("createAdapter().configure(config) applies config", async () => {
    let capturedConfig: any;
    const a = createAdapter()
      .configure({ timeout: 3000 })
      .use(async (ctx, next) => {
        capturedConfig = { ...ctx.config };
        await next();
      })
      .route({ model: /.*/ }, makeProvider("test"));

    await a.completion({ model: "test", messages: [] });
    expect(capturedConfig.timeout).toBe(3000);
  });

  test("singleton adapter is an AdaPter instance", () => {
    expect(adapter).toBeInstanceOf(AdaPter);
  });
});

// ─── No model specified ────────────────────────────────────────────────────

describe("error: no model", () => {
  test("throws when no model is specified anywhere", async () => {
    const a = createAdapter().route({ model: /.*/ }, makeProvider("test"));
    try {
      await a.completion({ messages: [] } as any);
      throw new Error("expected completion() to throw");
    } catch (err) {
      expect((err as Error).message).toMatch(/No model specified\.?/);
    }
  });
});

// ─── Three-level config priority ──────────────────────────────────────────

describe("three-level config merge priority", () => {
  test("call-level > API-level > global-level", async () => {
    let resolvedModel: string | undefined;
    let resolvedTimeout: number | undefined;

    const a = createAdapter()
      .configure({ model: "global-model", timeout: 1000 })
      .configure("completion", { model: "api-model", timeout: 2000 })
      .use(async (ctx, next) => {
        resolvedModel = ctx.config.model as string;
        resolvedTimeout = ctx.config.timeout;
        await next();
      })
      .route({ model: /.*/ }, makeProvider("test"));

    // Call with call-level override
    await a.completion({ model: "call-model", timeout: 3000, messages: [] });

    expect(resolvedModel).toBe("call-model");
    expect(resolvedTimeout).toBe(3000);
  });

  test("API-level > global-level when no call-level", async () => {
    let resolvedTimeout: number | undefined;

    const a = createAdapter()
      .configure({ timeout: 1000 })
      .configure("completion", { timeout: 2000, model: "api-model" })
      .use(async (ctx, next) => {
        resolvedTimeout = ctx.config.timeout;
        await next();
      })
      .route({ model: /.*/ }, makeProvider("test"));

    await a.completion({ messages: [] });

    expect(resolvedTimeout).toBe(2000);
  });

  test("global-level used when no API-level or call-level", async () => {
    let resolvedTimeout: number | undefined;

    const a = createAdapter()
      .configure({ timeout: 1000, model: "global-model" })
      .use(async (ctx, next) => {
        resolvedTimeout = ctx.config.timeout;
        await next();
      })
      .route({ model: /.*/ }, makeProvider("test"));

    await a.completion({ messages: [] });

    expect(resolvedTimeout).toBe(1000);
  });

  test("API params (temperature) support three-level merge", async () => {
    let capturedTemp: number | undefined;

    const a = createAdapter()
      .configure({ temperature: 0.5 })
      .configure("completion", { temperature: 0.7, model: "test" })
      .use(async (ctx, next) => {
        capturedTemp = ctx.config.temperature;
        await next();
      })
      .route({ model: /.*/ }, makeProvider("test"));

    // API-level wins over global
    await a.completion({ messages: [] });
    expect(capturedTemp).toBe(0.7);

    // Call-level wins over API-level
    await a.completion({ messages: [], temperature: 0.9 });
    expect(capturedTemp).toBe(0.9);
  });
});

// ─── Context fields verification ──────────────────────────────────────────

describe("context fields", () => {
  test("startTime is set on context creation", async () => {
    let capturedStartTime: number | undefined;

    const a = createAdapter()
      .use(async (ctx, next) => {
        capturedStartTime = ctx.startTime;
        await next();
      })
      .route({ model: /.*/ }, makeProvider("test"));

    const before = Date.now();
    await a.completion({ model: "gpt-4", messages: [] });
    const after = Date.now();

    expect(capturedStartTime).toBeDefined();
    expect(capturedStartTime!).toBeGreaterThanOrEqual(before);
    expect(capturedStartTime!).toBeLessThanOrEqual(after);
  });

  test("ctx.modelId, ctx.providerKey, ctx.model are set before middleware runs", async () => {
    let fields: Record<string, any> = {};

    const a = createAdapter()
      .use(async (ctx, next) => {
        fields = {
          modelId: ctx.modelId,
          providerKey: ctx.providerKey,
          model: ctx.model,
        };
        await next();
      })
      .route({ provider: "openai" }, makeProvider("openai"));

    await a.completion({ model: "openai/gpt-4", messages: [] });

    expect(fields.modelId).toBe("openai/gpt-4");
    expect(fields.providerKey).toBe("openai");
    expect(fields.model).toBe("gpt-4");
  });

  test("ctx.provider and ctx.handler are set before middleware runs", async () => {
    const prov = makeProvider("test");
    let capturedProvider: any;
    let capturedHandler: any;

    const a = createAdapter()
      .use(async (ctx, next) => {
        capturedProvider = ctx.provider;
        capturedHandler = ctx.handler;
        await next();
      })
      .route({ model: /.*/ }, prov);

    await a.completion({ model: "test-model", messages: [] });

    expect(capturedProvider).toBe(prov);
    expect(capturedHandler).toBeDefined();
  });

  test("ctx.request is populated before middleware runs", async () => {
    let capturedRequest: any;

    const a = createAdapter()
      .use(async (ctx, next) => {
        capturedRequest = { ...ctx.request };
        await next();
      })
      .route({ model: /.*/ }, makeProvider("test"));

    await a.completion({ model: "test-model", messages: [] });

    expect(capturedRequest.url).toBe("https://api.test.com/v1/completions");
    expect(capturedRequest.method).toBe("POST");
  });

  test("ctx.config.stream is false for completion()", async () => {
    let streamValue: boolean | undefined;

    const a = createAdapter()
      .configure({ stream: false })
      .use(async (ctx, next) => {
        streamValue = ctx.config.stream;
        await next();
      })
      .route({ model: /.*/ }, makeProvider("test"));

    await a.completion({ model: "test", messages: [] });

    expect(streamValue).toBe(false);
  });

  test("ctx.config contains both framework config and API params", async () => {
    let capturedConfig: any;

    const a = createAdapter()
      .configure({ timeout: 5000 })
      .use(async (ctx, next) => {
        capturedConfig = { ...ctx.config };
        await next();
      })
      .route({ model: /.*/ }, makeProvider("test"));

    await a.completion({
      model: "gpt-4",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.8,
      timeout: 3000,
    });

    // Framework config
    expect(capturedConfig.timeout).toBe(3000); // call-level overrides global
    // API params
    expect(capturedConfig.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(capturedConfig.temperature).toBe(0.8);
    expect(capturedConfig.model).toBe("gpt-4");
  });

  test("ctx.response.raw and ctx.response.data are set after middleware pipeline", async () => {
    let capturedResponse: any;

    const a = createAdapter()
      .use(async (ctx, next) => {
        await next();
        capturedResponse = {
          hasRaw: ctx.response.raw instanceof Response,
          data: ctx.response.data,
        };
      })
      .route({ model: /.*/ }, makeProvider("test"));

    await a.completion({ model: "test", messages: [] });

    expect(capturedResponse.hasRaw).toBe(true);
    expect(capturedResponse.data).toBeDefined();
  });
});

// ─── Multiple API-type configs ────────────────────────────────────────────

describe("multiple API-type configs", () => {
  test("different apiTypes get their own configs", async () => {
    const a = createAdapter()
      .configure("completion", { model: "gpt-4", timeout: 5000 })
      .configure("embedding", {
        model: "text-embedding-ada-002",
        timeout: 3000,
      });

    let completionConfig: any;

    a.use(async (ctx, next) => {
      if (ctx.apiType === "completion") {
        completionConfig = { ...ctx.config };
      }
      await next();
    }).route({ model: /.*/ }, makeProvider("test"));

    await a.completion({ messages: [] });

    expect(completionConfig.model).toBe("gpt-4");
    expect(completionConfig.timeout).toBe(5000);
  });
});

// ─── Chaining API ─────────────────────────────────────────────────────────

describe("fluent chaining", () => {
  test("all methods return this for chaining", () => {
    const a = new AdaPter();
    const result = a
      .use(async (_, next) => next())
      .configure({ timeout: 1000 })
      .configure("completion", { model: "gpt-4" })
      .route({ model: /^gpt-/ }, makeProvider("openai"))
      .route((_) => null)
      .autoRoute();

    expect(result).toBe(a);
  });
});

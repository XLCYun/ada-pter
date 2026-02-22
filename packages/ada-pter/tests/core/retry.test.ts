/// <reference path="../bun-test.d.ts" />

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { RetryController } from "../../src/core/retry";
import { ProviderError, TimeoutError } from "../../src/errors";
import type { AdapterContext } from "../../src/types/core";
import type { ApiHandler, Provider } from "../../src/types/provider";

function makeProvider(name = "test", handler?: ApiHandler | null): Provider {
  return {
    name,
    getHandler: () => handler ?? null,
  };
}

function makeCtx(overrides: Partial<AdapterContext> = {}): AdapterContext {
  const provider = overrides.provider ?? makeProvider();
  const model = overrides.model ?? "gpt-4";
  const providerKey = overrides.providerKey ?? "test";

  return {
    apiType: "completion",
    config: {
      maxRetries: 2,
      retryDelay: 0,
      maxRetryDelay: 0,
      ...overrides.config,
    },
    state: {},
    modelId: `${providerKey}/${model}`,
    providerKey,
    model,
    normModel: model.toLowerCase(),
    normProvider: providerKey.toLowerCase(),
    normModelId: `${providerKey.toLowerCase()}/${model.toLowerCase()}`,
    provider,
    handler: overrides.handler,
    request: {
      url: "https://api.test.com/v1/completions",
      method: "POST",
    },
    response: {},
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;
const originalMathRandom = Math.random;
const originalDateNow = Date.now;

const mockFetch = mock((..._args: Parameters<typeof fetch>) =>
  Promise.resolve(new Response()),
);

beforeEach(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockReset();
  Math.random = () => 0.5;
  Date.now = () => 1_700_000_000_000;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Math.random = originalMathRandom;
  Date.now = originalDateNow;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  Math.random = originalMathRandom;
  Date.now = originalDateNow;
});

describe("RetryController", () => {
  test("sleepWithSignal throws immediately when already aborted", async () => {
    const ctx = makeCtx();
    const retry = new RetryController(ctx);

    const controller = new AbortController();
    controller.abort();

    await expect(
      retry["sleepWithSignal"](10, controller.signal as AbortSignal),
    ).rejects.toHaveProperty("name", "AbortError");
  });

  test("sleepWithSignal rejects when aborted during wait", async () => {
    const ctx = makeCtx();
    const retry = new RetryController(ctx);
    const controller = new AbortController();

    const promise = retry["sleepWithSignal"](1, controller.signal);
    controller.abort();

    await expect(promise).rejects.toHaveProperty("name", "AbortError");
  });

  test("sleepWithSignal resolves and removes abort listener when timer completes", async () => {
    const ctx = makeCtx();
    const retry = new RetryController(ctx);

    const removeEventListener = mock();
    let capturedHandler: (() => void) | undefined;

    const signal = {
      aborted: false,
      addEventListener: (_event: string, handler: () => void) => {
        capturedHandler = handler;
      },
      removeEventListener,
    } as unknown as AbortSignal;

    await retry["sleepWithSignal"](1, signal);

    expect(removeEventListener).toHaveBeenCalledWith("abort", capturedHandler);
  });

  test("returns on first successful attempt", async () => {
    const res = new Response("ok", { status: 200 });
    mockFetch.mockResolvedValueOnce(res);
    const onSuccess = mock(async () => {});

    const ctx = makeCtx();
    const retry = new RetryController(ctx);

    await retry.run(ctx.request, onSuccess);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(res);
    expect(ctx.response.raw).toBe(res);
  });

  test("throws ProviderError for non-retryable HTTP status", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("bad request", { status: 400 }),
    );

    const ctx = makeCtx();
    const retry = new RetryController(ctx);

    await expect(retry.run(ctx.request, async () => {})).rejects.toBeInstanceOf(
      ProviderError,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("does not retry HTTP 501 even though it is >= 500", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("not implemented", { status: 501 }),
    );

    const ctx = makeCtx();
    const retry = new RetryController(ctx);

    await expect(retry.run(ctx.request, async () => {})).rejects.toBeInstanceOf(
      ProviderError,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("retries retryable HTTP status and then succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response("too many requests", {
          status: 429,
          headers: { "retry-after": "1" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const onSuccess = mock(async () => {});
    const ctx = makeCtx({
      config: { maxRetries: 1, retryDelay: 0, maxRetryDelay: 0 },
    });
    const retry = new RetryController(ctx);

    await retry.run(ctx.request, onSuccess);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test("retries 503 with Retry-After date header and succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response("service unavailable", {
          status: 503,
          headers: { "retry-after": "Tue, 14 Nov 2023 22:13:21 GMT" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const ctx = makeCtx({
      config: { maxRetries: 1, retryDelay: 0, maxRetryDelay: 0 },
    });
    const retry = new RetryController(ctx);

    await retry.run(ctx.request, async () => {});

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("retries network errors until success", async () => {
    const netErr = new Error("network");
    mockFetch
      .mockRejectedValueOnce(netErr)
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const onSuccess = mock(async () => {});
    const ctx = makeCtx({
      config: { maxRetries: 1, retryDelay: 0, maxRetryDelay: 0 },
    });
    const retry = new RetryController(ctx);

    await retry.run(ctx.request, onSuccess);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test("does not retry ProviderError thrown by fetch", async () => {
    const err = new ProviderError("test", 500, "raw");
    mockFetch.mockRejectedValueOnce(err);

    const ctx = makeCtx();
    const retry = new RetryController(ctx);

    await expect(retry.run(ctx.request, async () => {})).rejects.toBe(err);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("converts timeout abort into TimeoutError", async () => {
    const ac = new AbortController();
    ac.abort(new DOMException("operation timed out", "TimeoutError"));

    const err = new Error("aborted fetch");
    mockFetch.mockRejectedValueOnce(err);

    const ctx = makeCtx({
      signal: ac.signal,
      config: { timeout: 1234, maxRetries: 2, retryDelay: 0, maxRetryDelay: 0 },
    });
    const retry = new RetryController(ctx);

    await expect(retry.run(ctx.request, async () => {})).rejects.toEqual(
      expect.objectContaining({
        name: "TimeoutError",
        timeout: 1234,
      }),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("throws original error when aborted without timeout reason", async () => {
    const ac = new AbortController();
    const abortErr = new DOMException("Aborted", "AbortError");
    ac.abort(abortErr);

    const netErr = new Error("network down");
    mockFetch.mockRejectedValueOnce(netErr);

    const ctx = makeCtx({
      signal: ac.signal,
      config: { timeout: 1000, maxRetries: 2, retryDelay: 0, maxRetryDelay: 0 },
    });
    const retry = new RetryController(ctx);

    await expect(retry.run(ctx.request, async () => {})).rejects.toBe(netErr);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("throws TimeoutError instance directly without retry", async () => {
    const err = new TimeoutError(500);
    mockFetch.mockRejectedValueOnce(err);

    const ctx = makeCtx();
    const retry = new RetryController(ctx);

    await expect(retry.run(ctx.request, async () => {})).rejects.toBe(err);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

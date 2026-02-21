import { describe, expect, test } from "bun:test";
import { compose } from "../../src/core/compose";
import type { AdapterContext, Middleware } from "../../src/types";

/** Helper: create a minimal AdapterContext for testing. */
function createTestContext(
  overrides?: Partial<AdapterContext>,
): AdapterContext {
  return {
    apiType: "completion",
    request: { url: "" },
    response: {},
    config: {},
    state: {},
    modelId: "openai/gpt-4",
    providerKey: "openai",
    model: "gpt-4",
    normModel: "gpt-4",
    normProvider: "openai",
    normModelId: "openai/gpt-4",
    ...overrides,
  };
}

describe("compose", () => {
  test("onion model execution order", async () => {
    const order: string[] = [];

    const mw1: Middleware = async (_ctx, next) => {
      order.push("1-before");
      await next();
      order.push("1-after");
    };

    const mw2: Middleware = async (_ctx, next) => {
      order.push("2-before");
      await next();
      order.push("2-after");
    };

    const mw3: Middleware = async (_ctx, next) => {
      order.push("3-before");
      await next();
      order.push("3-after");
    };

    const ctx = createTestContext();
    await compose([mw1, mw2, mw3])(ctx);

    expect(order).toEqual([
      "1-before",
      "2-before",
      "3-before",
      "3-after",
      "2-after",
      "1-after",
    ]);
  });

  test("next() called multiple times throws error", async () => {
    const mw: Middleware = async (_ctx, next) => {
      await next();
      await next(); // second call — should throw
    };

    const ctx = createTestContext();
    await expect(compose([mw])(ctx)).rejects.toThrow(
      "next() called multiple times",
    );
  });

  test("empty middleware stack resolves successfully", async () => {
    const ctx = createTestContext();
    await expect(compose([])(ctx)).resolves.toBeUndefined();
  });

  test("error propagation from downstream middleware", async () => {
    const error = new Error("downstream failure");
    let caughtByUpstream: Error | undefined;

    const upstream: Middleware = async (_ctx, next) => {
      try {
        await next();
      } catch (err) {
        caughtByUpstream = err as Error;
        throw err; // re-throw so compose rejects
      }
    };

    const downstream: Middleware = async () => {
      throw error;
    };

    const ctx = createTestContext();
    await expect(compose([upstream, downstream])(ctx)).rejects.toThrow(
      "downstream failure",
    );
    expect(caughtByUpstream).toBe(error);
  });

  test("ctx is shared across all middleware", async () => {
    const mw1: Middleware = async (ctx, next) => {
      ctx.state.step1 = true;
      await next();
      // After downstream: step2 should already be set
      expect(ctx.state.step2).toBe(true);
    };

    const mw2: Middleware = async (ctx, next) => {
      // step1 from upstream should be visible
      expect(ctx.state.step1).toBe(true);
      ctx.state.step2 = true;
      await next();
    };

    const ctx = createTestContext();
    await compose([mw1, mw2])(ctx);

    expect(ctx.state.step1).toBe(true);
    expect(ctx.state.step2).toBe(true);
  });

  test("short-circuit when next() is not called", async () => {
    const order: string[] = [];

    const cache: Middleware = async (ctx, _next) => {
      order.push("cache-hit");
      ctx.response = { data: { cached: true } };
      // intentionally NOT calling next() — short-circuit
    };

    const provider: Middleware = async (_ctx, next) => {
      order.push("provider"); // should never run
      await next();
    };

    const ctx = createTestContext();
    await compose([cache, provider])(ctx);

    expect(order).toEqual(["cache-hit"]);
    expect(ctx.response).toEqual({ data: { cached: true } });
  });

  test("single middleware works correctly", async () => {
    const mw: Middleware = async (ctx, next) => {
      ctx.state.visited = true;
      await next();
    };

    const ctx = createTestContext();
    await compose([mw])(ctx);

    expect(ctx.state.visited).toBe(true);
  });

  test("middleware can modify response after next()", async () => {
    const inner: Middleware = async (ctx, next) => {
      ctx.response = { data: { content: "hello" } };
      await next();
    };

    const outer: Middleware = async (ctx, next) => {
      await next();
      // Modify response set by inner middleware
      (ctx.response.data as Record<string, unknown>).modified = true;
    };

    const ctx = createTestContext();
    await compose([outer, inner])(ctx);

    expect(ctx.response).toEqual({
      data: { content: "hello", modified: true },
    });
  });

  test("async middleware is properly awaited", async () => {
    const order: string[] = [];

    const mw1: Middleware = async (_ctx, next) => {
      order.push("1-start");
      await next();
      // Simulate async post-processing
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      order.push("1-end");
    };

    const mw2: Middleware = async (_ctx, next) => {
      // Simulate async work
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      order.push("2-start");
      await next();
      order.push("2-end");
    };

    const ctx = createTestContext();
    await compose([mw1, mw2])(ctx);

    expect(order).toEqual(["1-start", "2-start", "2-end", "1-end"]);
  });

  test("sync errors bubble immediately", () => {
    const error = new TypeError("sync fail");

    const mw: Middleware = () => {
      throw error;
    };

    const ctx = createTestContext();
    expect(() => compose([mw])(ctx)).toThrow(error);
  });

  test("downstream rejected promise propagates upstream", async () => {
    const mw1: Middleware = async (_ctx, next) => {
      await next();
    };

    const mw2: Middleware = () => Promise.reject(new Error("promise boom"));

    const ctx = createTestContext();
    await expect(compose([mw1, mw2])(ctx)).rejects.toThrow("promise boom");
  });

  test("upstream cleanup via finally still runs after downstream failure", async () => {
    const order: string[] = [];

    const upstream: Middleware = async (_ctx, next) => {
      order.push("up-before");
      try {
        await next();
      } finally {
        order.push("up-finally");
      }
    };

    const downstream: Middleware = async () => {
      order.push("down-before");
      throw new Error("boom");
    };

    const ctx = createTestContext();
    await expect(compose([upstream, downstream])(ctx)).rejects.toThrow("boom");
    expect(order).toEqual(["up-before", "down-before", "up-finally"]);
  });

  test("middleware that returns next() without async still chains correctly", async () => {
    const order: string[] = [];

    const mw1: Middleware = (_ctx, next) => {
      order.push("mw1-before");
      return next().then(() => {
        order.push("mw1-after");
      });
    };

    const mw2: Middleware = (_ctx, next) => {
      order.push("mw2-before");
      return next().then(() => {
        order.push("mw2-after");
      });
    };

    const mw3: Middleware = async () => {
      order.push("mw3");
    };

    const ctx = createTestContext();
    await compose([mw1, mw2, mw3])(ctx);

    expect(order).toEqual([
      "mw1-before",
      "mw2-before",
      "mw3",
      "mw2-after",
      "mw1-after",
    ]);
  });

  test("handles large middleware stack without blowing the call stack", async () => {
    const before: string[] = [];
    const after: string[] = [];
    const total = 50;

    const middlewares: Middleware[] = Array.from(
      { length: total },
      (_, i) => async (_ctx, next) => {
        before.push(`mw-${i}-before`);
        await next();
        after.push(`mw-${i}-after`);
      },
    );

    const ctx = createTestContext();
    await compose(middlewares)(ctx);

    expect(before).toEqual(
      Array.from({ length: total }, (_, i) => `mw-${i}-before`),
    );
    expect(after).toEqual(
      Array.from({ length: total }, (_, i) => `mw-${i}-after`).reverse(),
    );
  });

  test("reusing composed pipeline in parallel keeps contexts isolated", async () => {
    const order: string[] = [];

    const tracer: Middleware = async (ctx, next) => {
      const id = ctx.state.id as string;
      order.push(`enter-${id}`);
      await next();
      order.push(`exit-${id}`);
    };

    const leaf: Middleware = async (ctx) => {
      ctx.state.processed = true;
    };

    const pipeline = compose([tracer, leaf]);

    const ctxA = createTestContext({ state: { id: "A" } });
    const ctxB = createTestContext({ state: { id: "B" } });

    await Promise.all([pipeline(ctxA), pipeline(ctxB)]);

    expect(ctxA.state.processed).toBe(true);
    expect(ctxB.state.processed).toBe(true);
    expect(order.sort()).toEqual(["enter-A", "enter-B", "exit-A", "exit-B"]);
  });

  test("compose output complies with Middleware type", async () => {
    const noop: Middleware = async (_ctx, next) => {
      await next();
    };

    const pipeline = compose([noop]);

    const ctx = createTestContext();
    const result = pipeline(ctx);
    expect(result).toBeInstanceOf(Promise);
    await result;
  });

  test("composed pipeline can be embedded as middleware", async () => {
    const innerOrder: string[] = [];
    const outerOrder: string[] = [];

    const inner = compose([
      async (_ctx, next) => {
        innerOrder.push("inner-1-before");
        await next();
        innerOrder.push("inner-1-after");
      },
      async () => {
        innerOrder.push("inner-2");
      },
    ]);

    const outer: Middleware = async (_ctx, next) => {
      outerOrder.push("outer-before");
      await next();
      outerOrder.push("outer-after");
    };

    const composed = compose([
      outer,
      async (ctx, next) => {
        await inner(ctx);
        await next();
      },
    ]);

    const ctx = createTestContext();
    await composed(ctx);

    expect(outerOrder).toEqual(["outer-before", "outer-after"]);
    expect(innerOrder).toEqual(["inner-1-before", "inner-2", "inner-1-after"]);
  });
});

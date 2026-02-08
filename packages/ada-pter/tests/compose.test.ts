import { describe, test, expect } from 'bun:test';
import { compose } from '../src/core/compose';
import type { AdapterContext, Middleware } from '../src/types';

/** Helper: create a minimal AdapterContext for testing. */
function createTestContext(overrides?: Partial<AdapterContext>): AdapterContext {
  return {
    apiType: 'completion',
    request: {},
    stream: false,
    config: {},
    state: {},
    ...overrides,
  };
}

describe('compose', () => {
  test('onion model execution order', async () => {
    const order: string[] = [];

    const mw1: Middleware = async (_ctx, next) => {
      order.push('1-before');
      await next();
      order.push('1-after');
    };

    const mw2: Middleware = async (_ctx, next) => {
      order.push('2-before');
      await next();
      order.push('2-after');
    };

    const mw3: Middleware = async (_ctx, next) => {
      order.push('3-before');
      await next();
      order.push('3-after');
    };

    const ctx = createTestContext();
    await compose([mw1, mw2, mw3])(ctx);

    expect(order).toEqual([
      '1-before',
      '2-before',
      '3-before',
      '3-after',
      '2-after',
      '1-after',
    ]);
  });

  test('next() called multiple times throws error', async () => {
    const mw: Middleware = async (_ctx, next) => {
      await next();
      await next(); // second call — should throw
    };

    const ctx = createTestContext();
    await expect(compose([mw])(ctx)).rejects.toThrow(
      'next() called multiple times',
    );
  });

  test('empty middleware stack resolves successfully', async () => {
    const ctx = createTestContext();
    await expect(compose([])(ctx)).resolves.toBeUndefined();
  });

  test('error propagation from downstream middleware', async () => {
    const error = new Error('downstream failure');
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
      'downstream failure',
    );
    expect(caughtByUpstream).toBe(error);
  });

  test('ctx is shared across all middleware', async () => {
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

  test('short-circuit when next() is not called', async () => {
    const order: string[] = [];

    const cache: Middleware = async (ctx, _next) => {
      order.push('cache-hit');
      ctx.response = { cached: true };
      // intentionally NOT calling next() — short-circuit
    };

    const provider: Middleware = async (_ctx, next) => {
      order.push('provider'); // should never run
      await next();
    };

    const ctx = createTestContext();
    await compose([cache, provider])(ctx);

    expect(order).toEqual(['cache-hit']);
    expect(ctx.response).toEqual({ cached: true });
  });

  test('single middleware works correctly', async () => {
    const mw: Middleware = async (ctx, next) => {
      ctx.state.visited = true;
      await next();
    };

    const ctx = createTestContext();
    await compose([mw])(ctx);

    expect(ctx.state.visited).toBe(true);
  });

  test('middleware can modify response after next()', async () => {
    const inner: Middleware = async (ctx, next) => {
      ctx.response = { content: 'hello' };
      await next();
    };

    const outer: Middleware = async (ctx, next) => {
      await next();
      // Modify response set by inner middleware
      (ctx.response as Record<string, unknown>).modified = true;
    };

    const ctx = createTestContext();
    await compose([outer, inner])(ctx);

    expect(ctx.response).toEqual({ content: 'hello', modified: true });
  });

  test('async middleware is properly awaited', async () => {
    const order: string[] = [];

    const mw1: Middleware = async (_ctx, next) => {
      order.push('1-start');
      await next();
      // Simulate async post-processing
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      order.push('1-end');
    };

    const mw2: Middleware = async (_ctx, next) => {
      // Simulate async work
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      order.push('2-start');
      await next();
      order.push('2-end');
    };

    const ctx = createTestContext();
    await compose([mw1, mw2])(ctx);

    expect(order).toEqual(['1-start', '2-start', '2-end', '1-end']);
  });
});

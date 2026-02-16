import type { AdapterContext, Middleware } from "../types";

/**
 * Compose an array of middleware into a single function that executes them
 * in the classic Koa onion model: each middleware calls `await next()` to
 * pass control to the next layer, then resumes after it returns.
 *
 * Includes a safety check that throws if `next()` is called more than once
 * within the same middleware.
 */
export function compose(middlewares: Middleware[]) {
  return (ctx: AdapterContext): Promise<void> => {
    let index = -1;

    function dispatch(i: number): Promise<void> {
      if (i <= index) {
        return Promise.reject(new Error("next() called multiple times"));
      }
      index = i;
      const fn = middlewares[i];
      if (!fn) return Promise.resolve();
      return fn(ctx, () => dispatch(i + 1));
    }

    return dispatch(0);
  };
}

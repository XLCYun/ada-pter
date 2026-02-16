import { ProviderError } from "../errors";
import { autoResponseTransformers } from "../transformers/index";
import type { Middleware } from "../types/core";

/**
 * Create the internal request middleware that is automatically appended
 * as the innermost layer of the middleware pipeline.
 *
 * By the time this middleware runs, ctx.request has already been populated
 * by createContext() via handler.getRequestConfig(). Middleware in the pipeline
 * may have further modified ctx.request before this point.
 *
 * Responsibilities:
 * 1. Use ctx.request (url + RequestInit) to perform the fetch call.
 * 2. Save the raw Response to ctx.response.raw.
 * 3. On non-ok response, throw ProviderError.
 * 4. Execute handler.responseTransformers pipeline sequentially.
 */
export function createRequestMiddleware(): Middleware {
  return async (ctx) => {
    const { url, ...init } = ctx.request;

    const res = await fetch(url, init);
    ctx.response.raw = res;

    if (!res.ok) {
      const provider = ctx.provider;
      throw new ProviderError(
        provider?.name ?? "unknown",
        res.status,
        await res.text(),
      );
    }

    const handler = ctx.handler;
    if (!handler) throw new Error("[request] no handler found"); // should not happen

    const transformers =
      handler.responseTransformers.length === 0
        ? autoResponseTransformers
        : handler.responseTransformers;

    for (const transformer of transformers) {
      await transformer(ctx);
    }
  };
}

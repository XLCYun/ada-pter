import type { AdapterContext, RequestConfig } from "./core";

/**
 * Response transformer function.
 * Receives ctx with ctx.response.raw already set by Core after fetch completes.
 * Responsible for reading the response and writing results to ctx:
 * - Non-streaming: read ctx.response.raw, transform, store in ctx.response.data
 * - Streaming: read ctx.response.raw.body, build AsyncIterable, store in ctx.response.data
 *
 * Core provides reusable transformers (SSE parser, JSON parser, etc.)
 * that providers can compose with their own custom transformers.
 */
export type ResponseTransformer = (ctx: AdapterContext) => Promise<void>;

/**
 * Provider — a pure configuration object (not a middleware function).
 * Created via defineProvider() and registered to the route chain via adapter.route().
 *
 * Note: `name` is for identification and log/error messages only, NOT for route matching.
 * A single provider (e.g. a custom gateway) can handle requests for multiple provider prefixes.
 */
export interface Provider {
  /** Provider identifier, e.g. 'openai', 'my-gateway'.
   *  Used in log/error messages only. NOT used for route matching. */
  name: string;

  /** Dynamically returns the appropriate handler based on ctx (apiType, model, etc.).
   *  Returns null if this provider cannot handle the given (apiType, model) combination. */
  getHandler(ctx: AdapterContext): ApiHandler | null;
}

/**
 * Handler for a single API type. Tells the adapter how to build the request
 * and how to transform the response.
 *
 * getRequestConfig() builds the full HTTP request configuration (URL, method, headers, body).
 * responseTransformers is an ordered array of functions executed sequentially after fetch,
 * each reading from ctx and writing results back to ctx.
 * The adapter's createRequestMiddleware handles the actual fetch call.
 */
export interface ApiHandler {
  /** Build the full HTTP request configuration for this API call.
   *  Returns a RequestConfig (url + RequestInit fields) that will be merged into ctx.request.
   *  Called by createContext() after route resolution, before middleware pipeline starts.
   *  Handler can access ctx.config for API params, auth keys, etc. */
  getRequestConfig(ctx: AdapterContext): RequestConfig;

  /** Ordered array of response transformer functions.
   *  Executed sequentially by createRequestMiddleware after ctx.response.raw is set.
   *  Each transformer reads from ctx and writes results back to ctx.
   *
   *  Typical composition:
   *  - Non-streaming: [jsonParser, mapToUnifiedFormat]
   *  - Streaming: [sseParser, mapChunksToUnifiedFormat]
   *
   *  Core provides reusable transformers (SSE parser, JSON parser, etc.)
   *  that providers can compose with their own custom transformers. */
  responseTransformers: ResponseTransformer[];
}

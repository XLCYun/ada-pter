import type { AdapterConfig } from "./config";
import type { ApiHandler, Provider } from "./provider";

/**
 * API type identifier that determines which handler to use.
 * Only 'completion' is available in v1; more will be added as needed.
 * (string & {}) preserves custom extension capability without losing IDE autocompletion.
 */
export type ApiType = "completion" | (string & {});

/**
 * HTTP request configuration. Extends the standard RequestInit with a required `url` field.
 * Built by handler.getRequestConfig() and merged into ctx.request before middleware runs.
 * Middleware can read/modify ctx.request before the actual fetch call.
 */
export interface RequestConfig extends RequestInit {
  /** The request URL, e.g. 'https://api.openai.com/v1/chat/completions'. */
  url: string;
}

/**
 * Response container that carries both the raw fetch Response and the transformed data.
 * Populated by createRequestMiddleware:
 * - raw: the raw fetch Response object (always set after fetch completes)
 * - data: set by handler.responseTransformers pipeline (after response processing)
 */
export interface AdapterResponse {
  /** Raw fetch Response object. Set by createRequestMiddleware after fetch completes. */
  raw?: Response;
  /** Transformed response data. Set by handler.responseTransformers pipeline. */
  data?: unknown;
}

/**
 * Request context that flows through the entire middleware pipeline.
 * Similar to Koa's ctx — the sole carrier for middleware to read/write data.
 */
export interface AdapterContext {
  /** Current API type, e.g. 'completion'. Set by adapter.completion() etc. Immutable once set. */
  apiType: ApiType;

  /** Unified configuration after three-level merge (global > API-level > call-level).
   *  Contains both framework config (timeout, maxRetries, ...) and API request parameters (messages, temperature, ...).
   *  Handler picks needed fields from this object to build the request body.
   *  Readable by middleware and writable (for dynamic behavior adjustment). */
  config: AdapterConfig;

  /** HTTP request configuration. Populated by createContext via handler.getRequestConfig().
   *  Middleware can read/modify this before the request middleware sends the actual fetch call. */
  request: RequestConfig;

  /** Response container with raw Response and transformed data.
   *  Populated by createRequestMiddleware after fetch completes.
   *  Readable by middleware after await next(). */
  response: AdapterResponse;

  // ── Model parsing results (populated by createContext) ──

  /** The full model string as passed by the user, e.g. "openai/gpt-4" or "gpt-4". */
  modelId: string;

  /** Provider prefix extracted from modelId, e.g. "openai". */
  providerKey: string;

  /** Model name with prefix stripped, e.g. "gpt-4". */
  model: string;

  /** Lowercased model name (ctx.model normalized for matching), e.g. "gpt-4" or "chatgpt". */
  normModel: string;

  /** Lowercased provider name used for matching / auto-load, e.g. "openai". */
  normProvider: string;

  /** Lowercased composite id `${normProvider}/${normModel}` used for matching. */
  normModelId: string;

  // ── Route resolution results (populated by createContext) ──

  /** The matched Provider object. Set after route chain resolution or explicit provider config. */
  provider?: Provider;

  /** The matched ApiHandler (= provider.getHandler(ctx)). Set alongside provider. */
  handler?: ApiHandler;

  /** Cancellation signal. Created by createContext() using AbortSignal.timeout() based on config.timeout,
   *  merged with user-provided signal via AbortSignal.any(). Passed to fetch for cancellation and timeout. */
  signal?: AbortSignal;

  /** Custom state container, similar to Koa's ctx.state.
   *  Used for passing custom data between middleware (e.g. logger records start time, cost tracker records token count). */
  state: Record<string, unknown>;

  /** Request start timestamp (ms). Set by createContext(), used for duration calculation. */
  startTime?: number;

  /** Request end timestamp (ms). Set by execute() after pipeline completion. */
  endTime?: number;

  /** Error captured during pipeline execution. Can be set by middleware in catch blocks for upstream reading. */
  error?: Error;
}

/** The next function in the middleware chain. Calling it proceeds to the next middleware layer. */
export type Next = () => Promise<void>;

/** Middleware function signature. Receives context and next; uses await next() to implement the onion model. */
export type Middleware = (ctx: AdapterContext, next: Next) => Promise<void>;

import type { ProviderAdapter } from './provider';
import type { ResolvedConfig } from './config';

/**
 * API type identifier that determines which handler to use.
 * Only 'completion' is available in v1; more will be added as needed.
 * (string & {}) preserves custom extension capability without losing IDE autocompletion.
 */
export type ApiType = 'completion' | (string & {});

/**
 * Request context that flows through the entire middleware pipeline.
 * Similar to Koa's ctx — the sole carrier for middleware to read/write data.
 */
export interface AdapterContext {
  /** Current API type, e.g. 'completion'. Set by adapter.completion() etc. Immutable once set. */
  apiType: ApiType;

  /** Original call parameters from the user (e.g. { model, messages, temperature }).
   *  Internally uses Record<string, unknown> for flexibility; public API methods ensure type safety via generics. */
  request: Record<string, unknown>;

  /** Response result. Populated by executor's handler.transformResponse() (non-streaming),
   *  or by handler.customExecute(). Readable by middleware after await next(). */
  response?: unknown;

  /** The matched Provider object. Populated by the dispatch layer's route resolution.
   *  Middleware can access provider info via ctx.provider.name etc. after await next(). */
  provider?: ProviderAdapter;

  /** Resolved model name (prefix stripped, e.g. "openai/gpt-4" -> "gpt-4").
   *  Populated by the dispatch layer; used by executor to construct requests. */
  model?: string;

  /** Whether this is a streaming request. Set to true by adapter.completionStream(),
   *  false by adapter.completion(). Determines the executor's response handling branch. */
  stream: boolean;

  /** Async iterable for streaming responses. Populated by executor's parseSSE() (streaming),
   *  or by handler.customExecute(). adapter.executeStream() yields from this to the user. */
  streamResult?: AsyncIterable<unknown>;

  /** Cancellation signal. Created by createContext() using AbortSignal.timeout() based on config.timeout,
   *  merged with user-provided signal via AbortSignal.any(). Passed to fetch for cancellation and timeout. */
  signal?: AbortSignal;

  /** Final configuration after three-level merge (global > API-level > call-level).
   *  Readable by middleware (e.g. ctx.config.maxRetries) and writable (for dynamic behavior adjustment). */
  config: ResolvedConfig;

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

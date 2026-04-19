import type { AdapterContext } from "./core";

// biome-ignore lint/suspicious/noExplicitAny: string key / any value
type MapAny = Record<string, any>;

/**
 * Unified configuration type. Contains both framework behavior config and API request parameters.
 * Supports three-level merge: global > API-level > call-level.
 * All fields are optional; unset fields use framework defaults.
 *
 * When adding new fields, they MUST be explicitly declared here.
 */
export interface AdapterConfig extends MapAny {
  apiKey?: string | ((ctx: AdapterContext) => string);
  apiBase?: string | ((ctx: AdapterContext) => string);
  apiPath?: string | ((ctx: AdapterContext) => string);

  /** Whether to use streaming responses when supported by the handler. */
  stream?: boolean;

  /** Request timeout in milliseconds. Implemented via AbortSignal.timeout(). No timeout by default. */
  timeout?: number;

  /** Model name/ID, or an array for fallback chain.
   *  - string: e.g. 'gpt-4' or 'openai/gpt-4'
   *  - string[]: tried sequentially; next model is used when the current one fails (retries exhausted).
   */
  model?: string | string[];

  /** Callback invoked on fallback switch (when model array has multiple entries).
   *  Used for logging/monitoring. Args: (error, fromModel, toModel). */
  onFallback?: (error: Error, from: string, to: string) => void;

  /** Maximum number of retries. Only retries HTTP requests, does not re-run the middleware chain. Default: 3. */
  maxRetries?: number;

  /** Base delay for retries in milliseconds. Actual delay = baseDelay * 2^attempt (exponential backoff). Default: 1000. */
  retryDelay?: number;

  /** Maximum delay for a single retry wait (ms). When unset, no cap is applied. */
  maxRetryDelay?: number;

  /** Abort signal for cancellation. */
  signal?: AbortSignal;

  /** Arbitrary extra body fields merged into the provider-built request body (after provider mapping, so keys are provider-specific).
   *  Shallow-merged: top-level keys override provider-built keys with the same name. */
  extraBody?: Record<string, unknown>;

  /** Arbitrary extra HTTP headers merged into the provider-built request headers.
   *  Simple key-value merge: later values override earlier ones. */
  extraHeaders?: Record<string, string>;
}

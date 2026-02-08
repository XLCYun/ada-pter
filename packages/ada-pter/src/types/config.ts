/**
 * User-configurable options. Supports three-level merge: global > API-level > call-level.
 * All fields are optional; unset fields use framework defaults.
 */
export interface AdapterConfig {
  /** Request timeout in milliseconds. Implemented via AbortSignal.timeout(). No timeout by default. */
  timeout?: number;

  /** LLM temperature parameter. Read by handler.transformRequest() and written into the request body. */
  temperature?: number;

  /** Maximum number of tokens to generate. Read by handler.transformRequest() and written into the request body. */
  maxTokens?: number;

  // ---- Retry (executor layer) ----

  /** Maximum number of retries. Only retries HTTP requests, does not re-run the middleware chain. Default: 3. */
  maxRetries?: number;

  /** Base delay for retries in milliseconds. Actual delay = baseDelay * 2^attempt (exponential backoff). Default: 1000. */
  retryDelay?: number;

  // ---- Fallback (dispatch layer) ----

  /** List of fallback models. Tried sequentially after the primary model fails (retries exhausted).
   *  e.g. ['anthropic/claude-3-opus', 'openai/gpt-3.5-turbo']. */
  fallbackModels?: string[];

  /** Callback invoked on fallback switch. Used for logging/monitoring. Args: (error, fromModel, toModel). */
  onFallback?: (error: Error, from: string, to: string) => void;

  // ---- Provider auto-loading (auto-loader) ----

  /** Centralized configuration for each provider. Key is the provider name (e.g. 'openai'),
   *  value is the provider's config (e.g. { apiKey, baseURL }).
   *  Auto-loader uses this config first when loading a provider, falling back to environment variables. */
  providers?: Record<string, Record<string, unknown>>;
}

/**
 * Final configuration after three-level merge. Currently identical to AdapterConfig in structure.
 * Defined as a separate type for semantic clarity and potential future merge-specific fields.
 */
export type ResolvedConfig = AdapterConfig;

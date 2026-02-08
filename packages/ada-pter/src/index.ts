// Types (re-exported from types/)
export type {
  ApiType,
  AdapterContext,
  Middleware,
  Next,
} from './types';
export type { ProviderAdapter, ApiHandler } from './types';
export type { AdapterConfig, ResolvedConfig } from './types';
export type {
  Message,
  Choice,
  Usage,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from './types';

// Core
export { compose, deepMerge, extractConfig } from './core';

// Errors
export { AdaPterError, ProviderError, UnsupportedApiError, TimeoutError } from './errors';

export const VERSION = '0.0.1';

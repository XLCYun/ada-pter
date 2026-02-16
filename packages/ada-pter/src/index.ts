// Types (re-exported from types/)

// Core
export {
  AdaPter,
  adapter,
  compose,
  createAdapter,
  deepMerge,
  matchCondition,
  matchPattern,
  parseModelId,
} from "./core";
// Errors
export {
  AdaPterError,
  NoProviderError,
  ProviderError,
  TimeoutError,
  UnsupportedApiError,
} from "./errors";
export { defineProvider } from "./provider";
export type {
  JsonTransformerOptions,
  SseTransformerOptions,
} from "./transformers/index";
export {
  autoResponseTransformers,
  createJsonTransformer,
  createSseTransformer,
  jsonTransformer,
  sseTransformer,
} from "./transformers/index";
export type {
  AdapterConfig,
  AdapterContext,
  AdapterResponse,
  ApiHandler,
  ApiType,
  Choice,
  CompletionRequest,
  CompletionResponse,
  MatchPattern,
  Message,
  Middleware,
  Next,
  Provider,
  RequestConfig,
  ResponseTransformer,
  RouteCondition,
  RouteEntry,
  RouteResolver,
  StreamChunk,
  Usage,
} from "./types";

export const VERSION = "0.0.1";

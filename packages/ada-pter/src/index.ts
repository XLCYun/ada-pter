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

export { defaults } from "./defaults";
// Errors
export {
  AdaPterError,
  NoProviderError,
  ProviderError,
  TimeoutError,
  UnsupportedApiError,
} from "./errors";
export type {
  ResolveApiBaseOptions,
  ResolveApiKeyOptions,
  ResolveApiPathOptions,
} from "./helpers";
export {
  buildQuery,
  joinPath,
  resolveApiBase,
  resolveApiKey,
  resolveApiPath,
} from "./helpers";
export { defineProvider } from "./provider";
export type {
  JsonTransformerOptions,
  SseTransformerOptions,
} from "./transformers/index";
export {
  arrayBufferTransformer,
  autoResponseTransformers,
  createArrayBufferTransformer,
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
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageGenerationStreamChunk,
  MatchPattern,
  Middleware,
  Next,
  Provider,
  RequestConfig,
  ResponseCancelRequest,
  ResponseCancelResult,
  ResponseCompactRequest,
  ResponseCompactResult,
  ResponseCreateRequest,
  ResponseCreateResponse,
  ResponseCreateStreamChunk,
  ResponseDeleteRequest,
  ResponseDeleteResult,
  ResponseInputItemsListRequest,
  ResponseInputItemsListResponse,
  ResponseRetrieveRequest,
  ResponseRetrieveResponse,
  ResponseRetrieveStreamChunk,
  ResponseTransformer,
  RouteCondition,
  RouteEntry,
  RouteResolver,
  SpeechRequest,
  SpeechResponse,
  SpeechStreamChunk,
} from "./types";

export const VERSION = "0.0.1";

# @ada-pter/core Core Package (`packages/@ada-pter/core`) Implementation Plan (Synchronized with Current Code)

> This document has been updated to match the current repository implementation. Any parts from historical drafts that no longer match the codebase (such as OpenAI provider placeholder state, config-level provider bypassing route, built-in retry/timeout behavior in request middleware) have been removed or marked as not implemented.

## 1. Current Implementation Status

- Implemented: `AdaPter`, `createAdapter()`, and `adapter` singleton
- Implemented: routing chain via `route()` / `autoRoute()`, plus `parseModelId()` and provider inference
- Implemented: `Provider` / `ApiHandler` (`getRequestConfig` + `responseTransformers`)
- Implemented: built-in `jsonTransformer` / `sseTransformer` / `autoResponseTransformers`
- Implemented: `@ada-pter/openai` completion and streaming completion (also exports `autoProvider`)
- Implemented APIs: `completion`, `embedding`, `image.generation`, `transcription`, `speech`, and OpenAI Responses (`response.create/retrieve/cancel/delete/compact/input_items.list`)
- Implemented: request-level retry (`RetryController`) in `core/request.ts` (retries `fetch()` only; does not re-run middleware chain)
- Implemented: timeout + signal composition in `core/adapter.ts` via `AbortSignal.timeout()` + `AbortSignal.any()`, propagated into `ctx.signal` and `ctx.request.signal`
- Not yet implemented: additional APIs such as embedding/audio/image

## 2. Monorepo Structure (Current)

```txt
ada-pter/
  packages/
    ada-pter/
    providers/
      openai/
      anthropic/
    integrations/
      rxjs/
    middlewares/
      logger/
```

Workspace configuration:

```json
"workspaces": [
  "packages/@ada-pter/core",
  "packages/providers/*",
  "packages/integrations/*",
  "packages/middlewares/*"
]
```

## 3. Core Package Structure (Current)

```txt
packages/ada-pter/src/
  index.ts
  defaults.ts
  errors.ts
  provider.ts
  helpers/
  transformers/
  types/
    api/
    config.ts
    core.ts
    provider.ts
    route.ts
    index.ts
  core/
    adapter.ts
    auto-loader.ts
    compose.ts
    config.ts
    index.ts
    infer-providers/
    request.ts
    router.ts
```

## 4. Key Types and Interfaces

### 4.1 `AdapterConfig`

- Extends OpenAI completion parameters (`Partial<Omit<ChatCompletionCreateParamsBase, "model">>`)
- Also includes framework fields: `apiKey/apiBase/apiPath/stream/timeout/model/onFallback/maxRetries/retryDelay/signal`
- `model` supports `string | string[]`, where arrays represent fallback chains

### 4.2 `Provider` / `ApiHandler`

```ts
interface Provider {
  name: string;
  getHandler(ctx: AdapterContext): ApiHandler | null;
}

interface ApiHandler {
  getRequestConfig(ctx: AdapterContext): RequestConfig;
  responseTransformers: ResponseTransformer[];
}
```

### 4.3 Routing Types

```ts
type RouteCondition =
  | { modelId: MatchPattern }
  | { model: MatchPattern }
  | { provider: MatchPattern };

type RouteEntry =
  | { type: "condition"; condition: RouteCondition; provider: Provider }
  | { type: "resolver"; resolver: RouteResolver }
  | { type: "auto" };
```

## 5. Main Execution Flow (Actual Code)

1. `execute()` performs a 4-layer merge: `defaults -> globalConfig -> apiConfig -> call params`
2. Parse `model` into an array, then enter fallback loop
3. For each model, call `createContext()`:
   - Use `parseModelId()` to produce `modelId/providerKey/model/norm*`
   - Use `resolveFromRouteChain()` to set `ctx.provider` and `ctx.handler`
   - Merge `handler.getRequestConfig()` into `ctx.request`
   - Auto-fill `Content-Type`, and auto-`JSON.stringify` JSON body
4. Run middleware pipeline: `[...userMiddlewares, createRequestMiddleware()]`
5. Request middleware performs `fetch`, writes result to `ctx.response.raw`, then executes transformers serially into `ctx.response.data`
6. If an error occurs and there is a next model, trigger `onFallback(error, from, to)`

Retry / timeout / signal wiring (current code):

- `defaults.ts` provides framework defaults: `maxRetries: 2`, `retryDelay: 200`.
- `adapter.createContext()` composes a single runtime `AbortSignal`:
  - user cancellation: `config.signal`
  - timeout: `AbortSignal.timeout(config.timeout)` (when `timeout` is set)
  - composed via `AbortSignal.any([...])` when both are present
  - stored on `ctx.signal` and copied into `ctx.request.signal`
- `createRequestMiddleware()` instantiates `RetryController(ctx)` and delegates the fetch loop to it.
- Retry behavior:
  - retries transient HTTP statuses (e.g. `429/5xx`) with exponential backoff + jitter; honors `Retry-After` for `429/503`
  - on final attempt or non-retryable status, throws `ProviderError`
  - when the composed signal aborts due to timeout, throws `TimeoutError(timeoutMs)`; non-timeout abort reasons are preserved

## 6. Routing Chain Semantics

- Condition route matched: immediately commit this provider; if `getHandler()` is null, throw `UnsupportedApiError`
- Resolver route: if returns `null/undefined`, skip; if returns provider, commit
- Auto route: delegate to `autoLoader.resolve(ctx)`; if provider returned, commit
- If no route matches: throw `NoProviderError`

## 7. `autoRoute()` Auto Loading (Current)

- Dynamically loads package: `@ada-pter/<providerName>`
- Provider name comes from `ctx.normProvider` (`custom` is mapped to `openai`)
- Reads module export `autoProvider`
- On success: cache in `loaded`; on failure: record in `failedImports`
- Uses `provider.getHandler(ctx)` for compatibility check; if incompatible, returns `null`

## 8. Built-in Inference (Models Without Prefix)

- `inferProvider(model)` order:
  1) `MODEL_PROVIDER_REGISTRY`
  2) `inferOpenAIProvider` rules
  3) fallback: `custom`
- `parseModelId("gpt-4o")` normalizes to an internal identifier in `openai/gpt-4o` style

## 9. Current State of `@ada-pter/openai`

`packages/providers/openai/src/completion.ts` is implemented with:

- `autoProvider.name = "openai"`
- Supports only `ctx.apiType === "completion"`
- Non-streaming handler: `responseTransformers: [jsonTransformer]`
- Streaming handler: `responseTransformers: [sseTransformer]`
- Request parameters resolved via `resolveApiKey/resolveApiBase/resolveApiPath`

`packages/providers/openai/src/index.ts` exports `autoProvider`.

## 10. Differences from Historical Drafts (Already Corrected)

- No longer describes “OpenAI provider placeholder not implemented”
- No longer describes “config-level provider bypasses route” (not supported in current code)
- No longer describes “retry/timeout signal merge is already implemented in request middleware” (not yet wired)
- No longer describes separate `extractModels()` method (logic now inside `resolveConfig()`)
- No longer describes `provider.match` mechanism (not present in current provider interface)

## 11. Test Structure (Current)

`packages/ada-pter/tests/` currently mainly includes:

- `core/adapter.test.ts`
- `core/router.test.ts`
- `core/request.test.ts`
- `core/auto-loader.test.ts`
- `core/compose.test.ts`
- `core/config.test.ts`
- `core/infer-providers/*`
- `errors.test.ts`
- `provider.test.ts`
- `transformers/*`

Testing strategy remains local `fetch` mocking, with no real network required.

## 12. Next Suggestions (Roadmap)

1. Actually wire `maxRetries/retryDelay` in the request layer.
2. Wire timeout and signal merging in createContext/request flow and pass through to `fetch`.
3. Add APIs beyond completion (embedding/audio/image) and corresponding provider handlers.

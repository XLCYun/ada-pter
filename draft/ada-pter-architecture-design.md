# ada-pter Unified LLM Adapter Layer Architecture

## 1. Positioning and Core Philosophy

**One-line definition**: A TypeScript version of LiteLLM, centered on a middleware framework, with providers installed on demand as plugins.

**Core ideas**:

- **Framework + Plugins**: core is a Koa-style middleware engine; each LLM provider is a standalone npm package.
- **Onion model**: request/response flows through middleware stack, supporting cross-cutting concerns like cache short-circuiting, retry, and logging.
- **Type-first**: leverage TypeScript’s type system for safer APIs.
- **Cross-platform**: runs on Node.js / Browser / Deno / Bun / Edge Runtime.
- **Zero heavy dependencies in core**: core uses only native APIs (`Promise`, `AsyncIterable`, `AbortController`); optional capabilities (e.g. RxJS) are provided via separate packages.
- **Multiple API types**: unified support for completion, embedding, audio, image, etc., all sharing the same middleware pipeline.

---

## 2. Package Structure and Naming

The monorepo uses **Bun workspaces**. Packages are published independently, with zero coupling among adapters.

**Naming rule**: core package is `ada-pter`; all others are `@ada-pter/xxx`.

**Responsibility-based layout**: providers, optional integrations, and middleware packages are grouped under dedicated subdirectories.

```txt
ada-pter/
├── packages/
│   ├── ada-pter/              # npm: ada-pter              - Core framework (middleware engine + types + utilities)
│   ├── providers/
│   │   ├── openai/            # npm: @ada-pter/openai      - OpenAI adapter
│   │   └── anthropic/         # npm: @ada-pter/anthropic   - Anthropic adapter (future)
│   ├── integrations/
│   │   └── rxjs/              # npm: @ada-pter/rxjs        - Optional RxJS integration
│   └── middlewares/
│       └── logger/            # npm: @ada-pter/logger      - Logging middleware package
├── examples/
├── biome.json
├── tsconfig.base.json
└── package.json
```

Root `package.json` workspace config:

```json
"workspaces": [
  "packages/ada-pter",
  "packages/providers/*",
  "packages/integrations/*",
  "packages/middlewares/*"
]
```

Bun workspace globs only match directories containing `package.json`; parent directories like `providers/`, `integrations/`, and `middlewares/` are automatically skipped and do not cause issues.

Industry naming analogies:

- `hono` + `@hono/zod-validator`
- `fastify` + `@fastify/cors`
- `vite` + `@vitejs/plugin-react`

---

## 3. Core Architecture Design

### 3.1 Overall Architecture

**Core layers**:

- **Public AdaPter APIs**: one type-safe method per API type; internally sets `ctx.apiType` and enters the shared pipeline. Implemented API methods now include `completion`, `embedding`, `image.generation`, `transcription`, `speech`, and the OpenAI "Responses" family (`response.create/retrieve/cancel/delete/compact/input_items.list`).
- **Middleware pipeline**: fully generic and `apiType`-agnostic; logger/retry/fallback naturally apply to all API types.
- **Provider (plain object)**: selects handler by `ctx.apiType`, supplies `getRequestConfig()` and `responseTransformers`.
- **Core executor**: executes fetch using `ctx.request`, then runs response transformer pipeline (`JSON/SSE/auto`) — already implemented.
- **Roadmap/TODO**: additional OpenAI APIs (e.g., files/threads) and non-OpenAI providers for the newer API types.

Core stays dependency-light: Promise, AsyncIterable, AbortController, fetch. RxJS is available via optional `@ada-pter/rxjs`.

### 3.2 Middleware Engine (Onion Model)

Classic Koa compose (~20 LOC):

```typescript
function compose(middlewares: Middleware[]) {
  return (ctx: AdapterContext) => {
    let index = -1;
    function dispatch(i: number): Promise<void> {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      const fn = middlewares[i];
      if (!fn) return Promise.resolve();
      return fn(ctx, () => dispatch(i + 1));
    }
    return dispatch(0);
  };
}
```

> Retry will be implemented in request middleware (executor layer), and fallback already exists as an outer loop in `adapter.execute()`. Neither requires multiple `next()` invocations, so Koa’s safety guard is preserved.

Error handling is straightforward via `try/catch` around `await next()`:

```typescript
const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.error = error;
    // Unified error handling
  }
};
```

### 3.3 Core Type Definitions

```typescript
// ===== API type =====
type ApiType = 'completion' | (string & {});

// ===== Context =====
interface AdapterContext {
  apiType: ApiType;
  config: AdapterConfig;      // merged config
  request: RequestConfig;     // built by handler.getRequestConfig(), middleware may mutate
  response: AdapterResponse;  // raw + transformed

  modelId?: string;
  providerKey?: string;
  model?: string;

  provider?: Provider;
  handler?: ApiHandler;

  signal?: AbortSignal;
  state: Record<string, unknown>;
  startTime?: number;
  endTime?: number;
  error?: Error;
}

type Next = () => Promise<void>;
type Middleware = (ctx: AdapterContext, next: Next) => Promise<void>;

type MatchPattern = string | RegExp | (string | RegExp)[] | ((value: string) => boolean);

type RouteCondition =
  | { modelId: MatchPattern }
  | { model: MatchPattern }
  | { provider: MatchPattern };

type RouteResolver = (ctx: AdapterContext) => Provider | null | undefined;
```

### 3.4 Provider Interface (Done: `getRequestConfig` + `responseTransformers`)

A provider only needs to define:

- how to build request (`handler.getRequestConfig(ctx)`)
- how to process response (`handler.responseTransformers`)

Providers are plain objects (not middleware), registered through `adapter.route()`.

```typescript
interface Provider {
  name: string;
  getHandler(ctx: AdapterContext): ApiHandler | null;
}

type ResponseTransformer = (ctx: AdapterContext) => Promise<void>;

interface ApiHandler {
  getRequestConfig(ctx: AdapterContext): RequestConfig;
  responseTransformers: ResponseTransformer[];
}
```

`getHandler()` replaces static `handlers` map and can dynamically decide compatibility using context (`apiType`, model, etc.):

- returns `ApiHandler` → supported
- returns `null` → unsupported
- in `route()` hit + null handler → throw `UnsupportedApiError`
- in `autoRoute()` + null handler → skip and continue

### 3.5 Core Executor (Done: fetch + transformer pipeline)

`createContext()` prepares `ctx.provider`, `ctx.handler`, and `ctx.request` before middleware execution.

Current behavior:

- request middleware performs fetch
- writes raw response to `ctx.response.raw`
- runs response transformers to produce `ctx.response.data`

Benefits of unified executor:

- unified error handling (4xx/5xx/network)
- unified SSE parsing via `sseTransformer`
- unified timeout + cancellation via a single composed `AbortSignal` (wired in `createContext()` and propagated into `ctx.request.signal`)
- lower provider development cost
- easier testing with a single execution chokepoint

### 3.6 AdaPter Core Class (Done: multi-API + stream overloads)

Public methods are type-safe, but internally unified through `execute(apiType, params)`.

```typescript
class AdaPter {
  private middlewares: Middleware[] = [];
  private routeEntries: RouteEntry[] = [];
  private globalConfig: AdapterConfig = {};
  private apiConfigs: Map<string, Partial<AdapterConfig>> = new Map();

  use(middleware: Middleware): this;

  route(condition: RouteCondition, provider: Provider): this;
  route(resolver: RouteResolver): this;
  autoRoute(): this;

  configure(config: AdapterConfig): this;
  configure(apiType: ApiType, config: Partial<AdapterConfig>): this;

  completion(params: CompletionRequest): Promise<CompletionResponse>;
  completion(params: CompletionRequest & { stream: true }): AsyncIterable<CompletionChunk>;

  embedding(params: EmbeddingRequest): Promise<EmbeddingResponse>;

  imageGeneration(params: ImageGenerationRequest & { stream: true }): AsyncIterable<ImageGenerationStreamChunk>;
  imageGeneration(params: ImageGenerationRequest & { stream?: false | undefined }): Promise<ImageGenerationResponse>;

  transcription(params: TranscriptionRequest & { stream: true }): AsyncIterable<TranscriptionStreamChunk>;
  transcription(params: TranscriptionRequest & { stream?: false | null | undefined }): Promise<TranscriptionResponse>;

  speech(params: SpeechRequest & { stream: true }): AsyncIterable<SpeechStreamChunk>;
  speech(params: SpeechRequest & { stream?: false | undefined }): Promise<SpeechResponse>;

  createResponse(params: ResponseCreateRequest & { stream: true }): AsyncIterable<ResponseCreateStreamChunk>;
  createResponse(params: ResponseCreateRequest & { stream?: false | undefined }): Promise<ResponseCreateResponse>;
  cancelResponse(params: ResponseCancelRequest): Promise<ResponseCancelResult>;
  deleteResponse(params: ResponseDeleteRequest): Promise<ResponseDeleteResult>;
  compactResponse(params: ResponseCompactRequest): Promise<ResponseCompactResult>;
  retrieveResponse(params: ResponseRetrieveRequest & { stream: true }): AsyncIterable<ResponseRetrieveStreamChunk>;
  retrieveResponse(params: ResponseRetrieveRequest & { stream?: false | undefined }): Promise<ResponseRetrieveResponse>;
  listResponseInputItems(params: ResponseInputItemsListRequest): Promise<ResponseInputItemsListResponse>;

  private async execute<TRes>(apiType: ApiType, params: Record<string, unknown>): Promise<TRes> {
    const { config, models } = this.resolveConfig(apiType, params);

    let lastError: Error | undefined;
    for (let i = 0; i < models.length; i++) {
      try {
        const ctx = await this.createContext(apiType, config, models[i]);
        await compose(this.buildPipeline())(ctx);
        return ctx.response as TRes;
      } catch (err) {
        lastError = err as Error;
        if (i < models.length - 1) {
          config.onFallback?.(lastError, models[i], models[i + 1]);
          continue;
        }
      }
    }
    throw lastError!;
  }
}

export const adapter = new AdaPter();
export function createAdapter(): AdaPter {
  return new AdaPter();
}
```

Key changes (current codebase):

- `use()` only accepts middleware functions
- provider registration is managed by `route()`
- `autoRoute()` appends auto-loading fallback route
- `configure()` unifies global + API-level config via overloads
- `model` supports 3-level merge and fallback arrays
- `execute()` owns fallback loop, while config is resolved only once
- `createContext()` is async and completes route resolution before user middleware runs
- innermost middleware is `createRequestMiddleware()`
- multi-API surface is live: completion, embedding, image generation, transcription, speech, and OpenAI Responses APIs

### 3.7 Retry and Fallback (Current + Planned)

- Fallback is implemented in `adapter.execute()` outer loop.
- Request-level retry is implemented in the innermost request middleware via `RetryController` (retries the HTTP request only; does not re-run the middleware chain).
- Timeout and cancellation are implemented by composing `config.timeout` (via `AbortSignal.timeout()`) with `config.signal` (via `AbortSignal.any()`), then propagating the composed signal into `ctx.signal` and `ctx.request.signal`.

Fallback behavior:

- `model: string[]` is the fallback chain
- each model gets a fresh context and full middleware run
- `onFallback` is called between attempts

Retry behavior (request-level, inside `createRequestMiddleware()`):

- **Scope**: retries only wrap the `fetch()` call and response decoding; it does not re-run the middleware pipeline.
- **HTTP retry**: retries on selected transient HTTP statuses (e.g. `408/409/425/429/5xx`), with exponential backoff + jitter.
- **Retry-After**: honors `Retry-After` header for `429/503` when present.
- **Non-retryable HTTP**: on the final attempt (or non-retryable status), throws a typed `ProviderError`.
- **Abort + timeout**: if the composed signal is aborted due to timeout, the error is translated into `TimeoutError(timeoutMs)`; other abort reasons are preserved.
- **Defaults**: framework defaults are `maxRetries: 2`, `retryDelay: 200ms` (can be overridden at global / API / call level).

### 3.8 `@ada-pter/rxjs` (Optional Enhancement)

```typescript
import { Observable } from 'rxjs';
import type { AdaPter, CompletionRequest, StreamChunk } from 'ada-pter';

export function toObservable<T>(iterable: AsyncIterable<T>): Observable<T> {
  return new Observable(subscriber => {
    (async () => {
      try {
        for await (const item of iterable) {
          if (subscriber.closed) break;
          subscriber.next(item);
        }
        subscriber.complete();
      } catch (err) {
        subscriber.error(err);
      }
    })();
  });
}

export function withRxJS(adapter: AdaPter) {
  return {
    ...adapter,
    completion$(params: CompletionRequest): Observable<StreamChunk> {
      return toObservable(adapter.completion({ ...params, stream: true }));
    },
  };
}
```

### 3.9 Provider Plugin Example (`@ada-pter/openai` Current State)

Current implementation in `packages/providers/openai`:

- completion (streaming + non-streaming)
- embedding
- images
- transcription
- speech
- OpenAI Responses APIs (`response.create/retrieve/cancel/delete/compact/input_items.list`), including streaming variants where applicable

Dispatch logic: `autoProvider.getHandler(ctx)` selects by `ctx.apiType`, using `jsonTransformer` for non-streaming and `sseTransformer` for streaming where the upstream API streams.

---

## 4. User Usage Patterns

### 4.1 Built-in Singleton (Simplest)

Use exported `adapter` singleton with `autoRoute()` and environment variables.

```typescript
import { adapter } from 'ada-pter';

adapter.autoRoute();

const res = await adapter.completion({
  model: 'openai/gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

Streaming:

```typescript
for await (const chunk of adapter.completion({
  model: 'openai/gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
})) {
  process.stdout.write(chunk.content ?? '');
}
```

### 4.2 Custom Instance (3-Level Config)

Use `createAdapter()` for isolation (keys, middleware stacks, routes):

```typescript
const myAdapter = createAdapter()
  .configure({ timeout: 30_000, maxRetries: 3 })
  .route({ provider: 'openai' }, openaiProvider)
  .route({ provider: 'anthropic' }, anthropicProvider)
  .route({ model: /^(gpt-|o[0-9])/ }, openaiProvider)
  .route({ model: /^claude-/ }, anthropicProvider)
  .autoRoute();

myAdapter.configure('completion', { model: 'gpt-4', temperature: 0.9 });

const res = await myAdapter.completion({
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.2,
  timeout: 60_000,
});
```

### 4.3 Middleware + Retry + Fallback

```typescript
const adapter = createAdapter().configure({
  maxRetries: 3,
  retryDelay: 1000,
})
  .use(logger())
  .route({ model: /^(gpt-|o[0-9])/ }, openaiProvider)
  .route({ model: /^claude-/ }, anthropicProvider)
  .autoRoute();

const res = await adapter.completion({
  model: ['openai/gpt-4', 'anthropic/claude-3-opus', 'openai/gpt-3.5-turbo'],
  messages: [{ role: 'user', content: 'Hello' }],
  onFallback: (err, from, to) => console.warn(`${from} -> ${to}`),
});
```

### 4.4 Fallback (Multi-model Failover)

`model[]` replaces `fallbackModels` and provides clearer semantics.

### 4.5 Custom Middleware

Middleware applies to all API types by default and can gate by `ctx.apiType` for API-specific behavior.

### 4.6 Custom Provider (No Package Publishing Needed)

Use `defineProvider()` and `route()` directly to integrate internal/private providers.

### 4.7 Auto-loading Providers (Zero Manual Registration)

With `autoRoute()`, installed packages (e.g. `@ada-pter/openai`) can be resolved dynamically from model prefix or built-in inference.

### 4.8 Optional RxJS Enhancement

Use `withRxJS()` to add `completion$()` and compose RxJS operators.

---

## 5. Key Technical Decisions

### 5.1 Zero Heavy Dependencies in Core

- only native APIs in core
- no built-in RxJS or axios
- fallback done in `execute()` outer loop
- retry fields defined but runtime wiring is roadmap
- logger moved to standalone package

### 5.2 Networking: Unified Core Executor + fetch

- done: core handles fetch, errors, response transformers
- providers declare request and response handling declaratively
- built-in `sseTransformer` maps SSE to `AsyncIterable`

### 5.3 Streaming: `AsyncIterable`

- unified stream type: `AsyncIterable<StreamChunk>`
- portable, dependency-free, idiomatic JS (`for await...of`)
- easy optional conversion to RxJS via helper

#### 5.3.1 Middleware Semantics for Streaming

For streaming responses, middleware pipeline establishes and attaches the stream, but does not consume it inside the pipeline.

- `await next()` means stream is ready on `ctx.response.data`, not fully consumed.
- chunk consumption happens on the caller side.

Recommended split:

- **request-level middleware**: request lifecycle concerns (auth, route, throttling, TTFB, etc.)
- **result-level middleware**: logic that must run after stream completion (billing, final logging, cleanup)
- **chunk-level middleware** (optional): per-chunk transforms/stats/filtering

Recommended result-level pattern: wrap `ctx.response.data` after `await next()`:

```ts
const middlewareA: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();

  const inner = ctx.response.data as AsyncIterable<unknown> | undefined;
  if (!inner) return;

  ctx.response.data = (async function* () {
    try {
      for await (const chunk of inner) {
        yield chunk;
      }
    } finally {
      const elapsed = Date.now() - start;
      ctx.state.streamElapsedMs = elapsed;
    }
  })();
};
```

### 5.4 Config System: Three-level Merge

- global: `configure({...})`
- API-level: `configure('completion', {...})`
- call-level: per invocation params (highest priority)
- merge precedence: call > API-level > global
- `model` supports `string | string[]`

### 5.5 Multiple API Types: Shared Pipeline + Type Dispatch

- add new API type by adding AdaPter method + provider handler
- middleware and executor remain unchanged

### 5.6 ESM-only Output

- all packages emit ESM (`.js + .d.ts`) only
- Node.js 18+ baseline aligns with native fetch and stable ESM support
- reduces CJS/ESM interop complexity

### 5.7 Provider Auto-loading

- injected via `autoRoute()` at route-chain tail
- infer provider from prefix or model registry
- dynamic import `@ada-pter/<providerName>`
- check compatibility via `getHandler(ctx)`
- cache loaded providers and track failed imports

### 5.8 Provider Routing via `route()` Chain

- first match wins by registration order
- route condition fields are mutually exclusive: `modelId` / `model` / `provider`
- route hit + incompatible handler is treated as config error (`UnsupportedApiError`)

### 5.9 Build and Release

- monorepo: Bun workspaces
- build: tsdown (Rolldown-based, ESM-only, DTS output)
- tests: Bun test
- release: changesets
- lint/format: Biome

---

## 6. Scope of v1

- `ada-pter` core: middleware engine, route chain, config merge, unified executor, fallback chain via model array, autoRoute, provider inference, `defineProvider`, singleton export
- `@ada-pter/openai`: completion + streaming completion
- `@ada-pter/rxjs`: `toObservable`, `withRxJS`
- `@ada-pter/logger`: standalone logging middleware package

Future:

- `@ada-pter/anthropic`
- more providers (e.g. azure-openai)
- more middleware packages
- proxy server

---

## 7. Comparison with LiteLLM

- **Architecture**: single-package branching vs middleware framework + plugins
- **HTTP layer**: provider-specific handlers vs unified request middleware + transformers
- **Extensibility**: source modification vs plugin install/custom middleware/`defineProvider`
- **Provider onboarding**: add branch in core vs publish independent package
- **Multi-API support**: separate entrypoints vs shared pipeline + handler dispatch
- **Streaming abstraction**: wrapper-specific vs native `AsyncIterable` (+ optional RxJS)
- **Type safety**: runtime checks vs compile-time checks
- **Dependencies**: heavier core vs zero-heavy-dependency core

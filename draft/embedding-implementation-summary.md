---
name: Embedding Implementation Summary
---

## Background
- Added an OpenAI provider handler for the embeddings API and dispatch via `ctx.apiType` in `autoProvider`.

## Approach
- New file `packages/providers/openai/src/embedding.ts`:
  - `EMBEDDINGS_PATH` defaults to `/embeddings`.
  - `getRequestConfig`:
    - Uses `resolveRequestBase(ctx)` to obtain base URL and headers (including auth).
    - `resolveApiPath(ctx, { default: EMBEDDINGS_PATH })` allows path override.
    - Builds `EmbeddingCreateParams` request body: `input`, `model`, `dimensions`, `encoding_format`, `user`.
    - Returns POST config: `url`, `method`, `headers`, `body`.
  - `embeddingHandler` applies `jsonTransformer` for responses.
- Updated `packages/providers/openai/src/completion.ts`:
  - `getHandler` now a switch:
    - `completion`: chooses streaming or non-streaming completion handler based on `ctx.config.stream`.
    - `embedding`: returns the new `embeddingHandler` directly.
    - Others fall back to `getResponsesHandler`.

## Behavior & Compatibility
- Base and path can be overridden via env/config, matching existing OpenAI provider patterns.
- Request body: pulls from `ctx.config` into `EmbeddingCreateParams`; `model` comes from `ctx.model`.
- Response parsing: JSON by default, aligned with embeddings API output.

## Next Steps
- Add unit/integration tests for embeddings covering happy path and error scenarios.
- Extend README/provider docs with embeddings usage examples (config options, curl sample).

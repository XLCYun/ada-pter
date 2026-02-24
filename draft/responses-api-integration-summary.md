# Responses API Integration Summary (Core + OpenAI Provider)

This document summarizes the implemented plan for integrating OpenAI Responses APIs into `@ada-pter/core` core and `@ada-pter/openai`, including API typing, adapter method entrypoints, provider handler routing, and shared utility extraction.

## 1. Goals

- Add strongly-typed core API entrypoints for OpenAI Responses operations.
- Keep `apiType` fine-grained per operation.
- Ensure all `stream=true` Responses APIs return `AsyncIterable` externally.
- Keep completion + responses in the same OpenAI provider (`autoProvider`).
- Reuse shared helpers where possible.

## 2. Covered Responses Operations

The integration covers six operations:

1. `createResponse`
2. `cancelResponse`
3. `deleteResponse`
4. `compactResponse`
5. `retrieveResponse`
6. `listResponseInputItems`

## 3. Core Type and API Changes

### 3.1 New API typing layer

A dedicated Responses API type mapping was added:

- `packages/ada-pter/src/types/api/response.ts`

It defines request/response aliases for all six operations, including stream chunk types.

### 3.2 `ApiType` extension (fine-grained)

`ApiType` now includes:

- `response.create`
- `response.cancel`
- `response.delete`
- `response.compact`
- `response.retrieve`
- `response.input_items.list`

### 3.3 Adapter public methods

`AdaPter` now exposes six new methods:

- `createResponse(...)`
- `cancelResponse(...)`
- `deleteResponse(...)`
- `compactResponse(...)`
- `retrieveResponse(...)`
- `listResponseInputItems(...)`

Streaming overload policy:

- `stream: true` => `AsyncIterable<...>`
- non-streaming => `Promise<...>`

### 3.4 Request type correction for `retrieve`

`ResponseRetrieveRequest` now requires `response_id` at API typing level (instead of temporary intersection inside provider code), and similar path-param patterns are consistently typed.

## 4. OpenAI Provider Changes

### 4.1 Unified provider strategy

The same OpenAI `autoProvider` handles both completion and responses:

- `completion` apiType => completion handlers
- `response.*` apiTypes => responses handlers

### 4.2 Responses handlers

A dedicated module was added:

- `packages/providers/openai/src/responses.ts`

Implemented endpoint mapping:

- create: `POST /responses`
- cancel: `POST /responses/{response_id}/cancel`
- delete: `DELETE /responses/{response_id}`
- compact: `POST /responses/compact`
- retrieve: `GET /responses/{response_id}`
- list input items: `GET /responses/{response_id}/input_items`

Transformer policy:

- `create` / `retrieve` with `stream=true` => `sseTransformer`
- otherwise => `jsonTransformer`

### 4.3 Explicit create body mapping

In `createRequestConfig`, `ResponseCreateRequest` fields are explicitly extracted and assembled into request body, rather than passing `ctx.config` directly.

## 5. Utility Extraction

### 5.1 OpenAI provider utility

- `resolveRequestBase` is extracted to `packages/providers/openai/src/utils.ts`.

### 5.2 Core helper utility

- `buildQuery` has been centralized into core helper:
  - `packages/ada-pter/src/helpers/query.ts`
- It is exported from `@ada-pter/core` package entry and consumed in provider code.

## 6. Key Behavioral Decisions (Confirmed)

1. `compactResponse` uses `POST /responses/compact`.
2. All `stream=true` responses return `AsyncIterable` externally.
3. `apiType` is fine-grained per responses operation.
4. Completion and responses are handled by one OpenAI provider.

## 7. Notes

- The integration follows minimal-intrusion changes on top of existing completion architecture.
- The design keeps the provider pattern consistent: `getRequestConfig + responseTransformers`.
- Typing improvements were moved upward to API layer to avoid repeated ad-hoc casts in handlers.

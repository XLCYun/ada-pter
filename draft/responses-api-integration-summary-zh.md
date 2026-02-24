# Responses API 集成方案总结（Core + OpenAI Provider）

本文总结了将 OpenAI Responses API 接入 `@ada-pter/core` core 与 `@ada-pter/openai` 的实现方案，包括：API 类型扩展、adapter 对外方法、provider handler 分发，以及可复用工具方法提取。

## 1. 目标

- 在 core 中提供强类型的 Responses API 调用入口。
- `apiType` 采用细粒度（每个操作一个类型）。
- 所有 `stream=true` 的 Responses 调用对外统一返回 `AsyncIterable`。
- completion 与 responses 共用同一个 OpenAI provider（`autoProvider`）。
- 抽取通用能力，减少重复实现。

## 2. 覆盖的 Responses 操作

本次支持 6 个操作：

1. `createResponse`
2. `cancelResponse`
3. `deleteResponse`
4. `compactResponse`
5. `retrieveResponse`
6. `listResponseInputItems`

## 3. Core 侧改动

### 3.1 新增 Responses API 类型层

新增：

- `packages/ada-pter/src/types/api/response.ts`

用于统一定义 6 个操作的请求/响应类型别名，以及流式 chunk 类型。

### 3.2 扩展 `ApiType`（细粒度）

新增以下 `apiType`：

- `response.create`
- `response.cancel`
- `response.delete`
- `response.compact`
- `response.retrieve`
- `response.input_items.list`

### 3.3 扩展 AdaPter 对外方法

`AdaPter` 增加 6 个公开方法：

- `createResponse(...)`
- `cancelResponse(...)`
- `deleteResponse(...)`
- `compactResponse(...)`
- `retrieveResponse(...)`
- `listResponseInputItems(...)`

流式重载策略：

- `stream: true` => `AsyncIterable<...>`
- 非流式 => `Promise<...>`

### 3.4 `retrieve` 类型补全

`ResponseRetrieveRequest` 已在 API 类型层直接要求 `response_id`，避免在 provider 内再做 `& { response_id: string }` 临时拼接；类似路径参数接口也采用同样思路。

## 4. OpenAI Provider 侧改动

### 4.1 单 provider 统一分发

同一个 OpenAI `autoProvider` 同时处理 completion 与 responses：

- `completion` 走 completion handlers
- `response.*` 走 responses handlers

### 4.2 新增 responses handlers 模块

新增：

- `packages/providers/openai/src/responses.ts`

endpoint 映射如下：

- create: `POST /responses`
- cancel: `POST /responses/{response_id}/cancel`
- delete: `DELETE /responses/{response_id}`
- compact: `POST /responses/compact`
- retrieve: `GET /responses/{response_id}`
- list input items: `GET /responses/{response_id}/input_items`

transformer 策略：

- `create` / `retrieve` 且 `stream=true`：`sseTransformer`
- 其余：`jsonTransformer`

### 4.3 create 请求体显式字段提取

`createRequestConfig` 中不再直接透传 `ctx.config`，改为按 `ResponseCreateRequest` 字段逐项组装 body，提升可读性与可控性。

## 5. 工具方法提取

### 5.1 OpenAI provider 层

- `resolveRequestBase` 提取到：
  - `packages/providers/openai/src/utils.ts`

### 5.2 Core helper 层

- `buildQuery` 独立到：
  - `packages/ada-pter/src/helpers/query.ts`
- 并通过 `@ada-pter/core` 主入口导出后供 provider 侧复用。

## 6. 已确认的关键决策

1. `compactResponse` 路径固定为 `POST /responses/compact`。
2. 所有 `stream=true` 的 Responses 响应对外统一 `AsyncIterable`。
3. `apiType` 采用细粒度。
4. completion 与 responses 在同一个 OpenAI provider 中实现。

## 7. 备注

- 本次集成遵循“最小侵入”原则，保持与现有 completion 架构一致。
- provider 仍采用统一模式：`getRequestConfig + responseTransformers`。
- 类型约束尽量上移到 API 层，减少 handler 中临时类型拼接。

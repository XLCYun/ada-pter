# ada-pter 核心包（packages/ada-pter）实现方案（按当前代码同步）

> 本文已按仓库当前实现更新。历史草案中与代码不一致的部分（如 OpenAI provider 占位、配置级 provider、request 内置 retry/timeout 等）已移除或标注为未实现。

## 1. 当前实现状态

- 已实现：`AdaPter`、`createAdapter()`、`adapter` 单例
- 已实现：`route()` / `autoRoute()` 路由链、`parseModelId()` 与 provider 推断
- 已实现：`Provider` / `ApiHandler`（`getRequestConfig` + `responseTransformers`）
- 已实现：内置 `jsonTransformer` / `sseTransformer` / `autoResponseTransformers`
- 已实现：`@ada-pter/openai` 的 completion 与 stream completion（并导出 `autoProvider`）
- 已实现 API：`completion`、`embedding`、`image.generation`、`transcription`、`speech`，以及 OpenAI Responses（`response.create/retrieve/cancel/delete/compact/input_items.list`）
- 未实现（类型有字段，但执行器尚未接入）：request 级 retry、timeout/signal 合并
- 未实现：embedding/audio/image 等更多 API 方法

## 2. Monorepo 结构（现状）

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

workspace 配置：

```json
"workspaces": [
  "packages/ada-pter",
  "packages/providers/*",
  "packages/integrations/*",
  "packages/middlewares/*"
]
```

## 3. 核心包结构（现状）

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

## 4. 关键类型与接口

### 4.1 `AdapterConfig`

- 扩展了 OpenAI completion 参数（`Partial<Omit<ChatCompletionCreateParamsBase, "model">>`）
- 同时包含框架字段：`apiKey/apiBase/apiPath/stream/timeout/model/onFallback/maxRetries/retryDelay/signal`
- `model` 支持 `string | string[]`，数组表示 fallback 链

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

### 4.3 路由类型

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

## 5. 执行主流程（实际代码）

1. `execute()` 做三层 merge：`defaults -> globalConfig -> apiConfig -> call params`
2. 解析 `model` 为数组，进入 fallback 循环
3. 每个 model 调 `createContext()`：
   - `parseModelId()` 得到 `modelId/providerKey/model/norm*`
   - `resolveFromRouteChain()` 设置 `ctx.provider` 与 `ctx.handler`
   - `handler.getRequestConfig()` 结果合并进 `ctx.request`
   - 自动补 `Content-Type`，JSON body 自动 `JSON.stringify`
4. 跑中间件：`[...userMiddlewares, createRequestMiddleware()]`
5. request 中间件执行 `fetch`，写入 `ctx.response.raw`，再串行执行 transformers 写 `ctx.response.data`
6. 出错时如有下一个 model，触发 `onFallback(error, from, to)`

## 6. 路由链语义

- 条件路由命中：立即提交该 provider；若 `getHandler()` 为空，抛 `UnsupportedApiError`
- resolver 路由：返回 `null/undefined` 则跳过，返回 provider 则提交
- auto 路由：交给 `autoLoader.resolve(ctx)`；返回 provider 则提交
- 全部未命中：抛 `NoProviderError`

## 7. `autoRoute()` 自动加载（现状）

- 动态加载包名：`@ada-pter/<providerName>`
- provider 名来自 `ctx.normProvider`（`custom` 会被映射为 `openai`）
- 读取模块导出 `autoProvider`
- 加载成功后缓存到 `loaded`，加载失败记入 `failedImports`
- 通过 `provider.getHandler(ctx)` 做兼容性校验，不兼容则返回 `null`

## 8. 内置推断（无前缀模型）

- `inferProvider(model)` 顺序：
  1) `MODEL_PROVIDER_REGISTRY`
  2) `inferOpenAIProvider` 规则
  3) fallback: `custom`
- `parseModelId("gpt-4o")` 会归一化为 `openai/gpt-4o` 风格的内部标识

## 9. `@ada-pter/openai` 当前状态

`packages/providers/openai/src/completion.ts` 已实现：

- `autoProvider.name = "openai"`
- 仅支持 `ctx.apiType === "completion"`
- 非流式 handler：`responseTransformers: [jsonTransformer]`
- 流式 handler：`responseTransformers: [sseTransformer]`
- 请求参数通过 `resolveApiKey/resolveApiBase/resolveApiPath` 解析

`packages/providers/openai/src/index.ts` 已导出 `autoProvider`

## 10. 与历史草案差异（已修正）

- 不再描述 “OpenAI provider 占位未实现”
- 不再描述 “配置级 provider 绕过 route” （当前代码无该能力）
- 不再描述 “request 中间件内已实现 retry/timeout 信号合并” （当前未接入）
- 不再描述 `extractModels()` 独立方法（当前逻辑在 `resolveConfig()` 内完成）
- 不再描述 `provider.match` 机制（当前 provider 接口无该字段）

## 11. 测试结构（现状）

`packages/ada-pter/tests/` 目前主要包含：

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

测试策略仍是本地 mock fetch，无需真实网络。

## 12. 后续建议（Roadmap）

1. 在 request 层真正接入 `maxRetries/retryDelay`。
2. 在 createContext/request 流程接入 `timeout` 与 `signal` 合并并透传到 fetch。
3. 新增 completion 之外的 API（embedding/audio/image）及对应 provider handler。

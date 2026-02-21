---
name: Embedding 实现方案总结
---

## 背景
- 为 OpenAI provider 支持 embeddings API，新增专用 handler 并在 `autoProvider` 中按 `ctx.apiType` 分派。

## 方案概述
- 新增 `packages/providers/openai/src/embedding.ts`：
  - `EMBEDDINGS_PATH` 默认 `/embeddings`。
  - `getRequestConfig`：
    - 通过 `resolveRequestBase(ctx)` 拿到 base URL 和 headers（含鉴权）。
    - 使用 `resolveApiPath(ctx, { default: EMBEDDINGS_PATH })` 支持覆写 path。
    - 组装请求体 `EmbeddingCreateParams`：`input`、`model`、`dimensions`、`encoding_format`、`user`。
    - 返回 POST 请求配置（url、method、headers、body）。
  - `embeddingHandler` 使用 `jsonTransformer` 处理响应。
- 更新 `packages/providers/openai/src/completion.ts`：
  - `getHandler` 改为 switch：
    - `completion`：根据 `ctx.config.stream` 选择流式或非流式 completion handler。
    - `embedding`：直接返回新增的 `embeddingHandler`。
    - 其他情况回退 `getResponsesHandler`。

## 行为与兼容性
- 支持通过环境变量/配置覆盖 base 与 path，与现有 OpenAI provider 的配置方式一致。
- 请求体来源：`ctx.config` 透传到 `EmbeddingCreateParams`，`model` 来自 `ctx.model`。
- 响应解析：默认 JSON，符合 embeddings API 输出。

## 后续建议
- 为 embeddings 添加单元/集成测试覆盖正常请求与错误路径。
- 在 README/provider 文档补充 embeddings 用法示例（配置项、curl）。

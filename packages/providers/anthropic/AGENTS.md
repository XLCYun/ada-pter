# AGENTS.md 消息转换文档

## 目标

在 `packages/providers/anthropic` 的 completions 适配中，明确 OpenAI 消息到 Anthropic 消息的转换规则，覆盖：

1. 消息层面的转换规则（role 映射、system/developer 抽离、name 字段处理）
2. content 层面的转换规则（OpenAI content type 到 Anthropic `ContentBlockParam`）

---

## 一、消息转换总览

整体流程分两步：

```text
OpenAI messages[]
  -> extractSystem()  ->  Anthropic system: TextBlockParam[]
  -> mapMessages()    ->  Anthropic MessageParam[]
```

对应实现文件：`packages/providers/anthropic/src/map-messages.ts`

---

## 二、role 映射规则

| OpenAI role | 处理方式 |
| --- | --- |
| `system` | 抽离为 `system` 参数（`TextBlockParam[]`），不进入 `messages` 数组 |
| `developer` | 同 `system`，一并抽离为 `system` 参数（`TextBlockParam[]`） |
| `user` | 转为 Anthropic `user` 消息 |
| `tool` | 转为 Anthropic `user` 消息（包装为 `tool_result` block） |
| `function` | 转为 Anthropic `user` 消息（包装为 `tool_result` block） |
| `assistant` | 转为 Anthropic `assistant` 消息 |

补充规则：

- OpenAI 的 `name?: string` 在转换时一律丢弃（Anthropic 消息不支持）。
- 相邻同类消息会被合并：
  - 相邻 `user/tool/function` 合并为一条 `user` 消息
  - 相邻 `assistant` 合并为一条 `assistant` 消息

---

## 三、`extractSystem()` 细节

`extractSystem()` 负责从原始消息中抽离 system 输入：

- 提取 `role === "system"` 或 `role === "developer"` 的消息
- 输出为 `TextBlockParam[]`（用于 `messages.create` 的 `system` 参数）
- 跳过空文本（Anthropic API 会拒绝空 text block）
- 其余消息保留在 `rest` 数组，交给 `mapMessages()`

content 处理：

- `string` -> `{ type: "text", text }`
- `Array<ChatCompletionContentPartText>` -> 逐项提取 `text`

---

## 四、各消息类型的 content 字段

| 消息类型 | content 类型 | 可包含的 part |
| --- | --- | --- |
| `developer` | `string | Array<ChatCompletionContentPartText>` | `text` |
| `system` | `string | Array<ChatCompletionContentPartText>` | `text` |
| `user` | `string | Array<ChatCompletionContentPart>` | `text`, `image_url`, `input_audio`, `file` |
| `tool` | `string | Array<ChatCompletionContentPartText>` | `text` |
| `function` | `string | null` | 纯字符串 |
| `assistant` | `string | Array<ChatCompletionContentPartText \| ChatCompletionContentPartRefusal> | null` | `text`, `refusal`，以及 `tool_calls`、`thinking_blocks` 扩展字段 |

---

## 五、`mapContentPart()` 转换规则（主要用于 user 消息）

OpenAI `ChatCompletionContentPart` 到 Anthropic block 的映射：

| OpenAI type | Anthropic 映射 | 说明 |
| --- | --- | --- |
| `text` | `TextBlockParam` | 直接映射文本 |
| `image_url` | `ImageBlockParam` | 支持 URL 与 data URL |
| `input_audio` | 跳过（不支持） | Anthropic 不支持输入音频，过滤该 part |
| `file` | `ContainerUploadBlockParam` | 使用 `file_id`，若无则回退 `file_data` |

说明：

- `refusal` 不属于 user content 输入类型，仅出现在 assistant 输出中。
- 扩展字段 `cache_control` 通过 `mergeCacheControl()` 透传到对应 Anthropic block。

### 图片处理（`mapImagePart()`）

- `http://` / `https://` -> `{ type: "image", source: { type: "url", url } }`
- `data:<mime>;base64,<data>` -> `{ type: "image", source: { type: "base64", media_type, data } }`
- 其他格式抛错

---

## 六、`tool/function` 消息转换（`mapToolOrFunctionMessageAsUserBlocks()`）

`tool` 与 `function` 都会转为 Anthropic `user` 消息中的 `tool_result` block：

- `tool_use_id`：
  - 优先使用 OpenAI 的 `tool_call_id`
  - 缺失时自动生成 ID
  - 对 ID 做字符清洗（非法字符替换为 `_`）
- `content`：
  - `string` -> 直接作为 `tool_result.content`
  - `Array<text>` -> 转为 `TextBlockParam[]`
  - `Array<text | image_url>` -> 转为 `(TextBlockParam | ImageBlockParam)[]`

---

## 七、`assistant` 消息转换（`mapAssistantMessage()`）

assistant 消息按以下顺序组装 Anthropic content blocks：

```text
[...thinkingBlocks, ...contentBlocks, ...toolUseBlocks, ...functionCallBlock]
```

### 1. `thinking_blocks`（扩展字段）

- 从 `msg.thinking_blocks` 读取，原样透传为 `ThinkingBlockParam` / `RedactedThinkingBlockParam`
- 必须放在最前面，否则 Anthropic API 会报错

### 2. `content` 处理（`mapAssistantContentArray()`）

**字符串 content**：非空时转为 `TextBlockParam`，通过 `mergeCacheControl(msg)` 透传 `cache_control`

**数组 content**：逐项按 `type` 分发处理：

| content part type | Anthropic 映射 | 说明 |
| --- | --- | --- |
| `text` | `TextBlockParam` | 空文本过滤；通过 `mergeCacheControl(part)` 透传 `cache_control` |
| `refusal` | `TextBlockParam` | 将 `refusal` 字段映射为 `text`（Anthropic 无 refusal 类型） |
| `thinking` | 原样透传 | 非空 `thinking` 文本时透传 |
| `redacted_thinking` | 原样透传 | 直接透传 |
| `server_tool_use` | 原样透传 | Anthropic 原生类型，直接透传 |
| `tool_search_tool_result` | 原样透传 | Anthropic 原生类型，直接透传 |
| 其他类型 | 跳过 | OpenAI assistant content 仅定义 `text` 和 `refusal`，其余为未知类型 |

### 3. `tool_calls` 处理（`mapAssistantToolCalls()`）

- 只处理 `type: "function"` 的 tool call（`custom` 类型跳过，Anthropic 无对应表示）
- 解析 `function.arguments` JSON 作为 `input`（解析失败时回退为 `{}`）
- **server tool 识别**：若 `id` 以 `srvtoolu_` 开头，生成 `{ type: "server_tool_use", id, name, input }`
- **普通 tool**：生成 `ToolUseBlockParam`，通过 `mergeCacheControl(call)` 透传 `cache_control`

### 4. `function_call` 处理（`mapAssistantFunctionCall()`，旧格式）

- 读取 `msg.function_call` 的 `name` 和 `arguments`
- 解析 `arguments` JSON 作为 `input`
- 生成 `ToolUseBlockParam`，`id` 使用 `crypto.randomUUID()` 或随机字符串回退

---

## 八、尾部 assistant 文本收尾处理

`trimFinalAssistantWhitespace()`：

- 若最后一条消息是 `assistant`
- 对其所有 text block 执行 `trimEnd()`
- 避免 Anthropic API 因尾部空白文本触发边界问题

---

## 九、`provider_specific_fields` 与 server_tool_use 重建

### 9.1 什么是 `provider_specific_fields`

`provider_specific_fields` 是**提供商特定字段**：一个可选字典（`Optional<Record<string, unknown>>`），挂在统一消息/响应对象上，用于在通用 OpenAI 风格结构之外携带**某家厂商专有、无法用通用字段表达的数据**。类型上一般为 `Dict[str, Any]`，在 message / choice 等对象上可选存在。

在跨厂商、多轮对话场景下，上游（例如 LiteLLM）在**把某厂商的原始响应转成统一消息格式**时，会把该厂商特有的内容写进 `provider_specific_fields`；在**把统一格式的历史消息再转回该厂商的请求格式**时，需要从 `provider_specific_fields` 里读回这些数据，才能正确重建厂商所需的请求体（例如 Anthropic 的 `server_tool_use` + `web_search_tool_result`）。

### 9.2 何时、何处被写入

**写入发生在上游**（例如 LiteLLM 的 Anthropic 响应转换层），而不是本 provider 内：

- **时机**：每次把 **Anthropic Messages API 的 completion 响应**转成统一消息格式（如 LiteLLM 的 `Message`）时。
- **位置**：在解析完 `content[]`（文本、tool_use、tool_result、thinking 等）后，构造一条 assistant 消息并为其设置 `provider_specific_fields`。

也就是说，**写入发生在「Anthropic 响应 → 统一 message」这一步**；本 provider 的 `map-messages` 只做「统一 messages → Anthropic 请求」的读取与使用。

### 9.3 写入了哪些字段

上游在构造 assistant 的 `provider_specific_fields` 时，会按是否有值写入以下键（具体以 LiteLLM 的 `litellm/llms/anthropic/chat/transformation.py` 为准）：

| 键 | 含义 | 来源 |
| --- | --- | --- |
| `citations` | 引用信息 | 响应 content 中带 `citations` 的块 |
| `thinking_blocks` | 思考块 | 响应中的 `thinking` / `redacted_thinking` 块 |
| `context_management` | 上下文管理 | 响应顶层 `context_management`（若有） |
| **`web_search_results`** | 网页搜索/抓取类工具结果 | 响应 content 中 `type === "web_search_tool_result"` 或 `"web_fetch_tool_result"` 的块 |
| `tool_results` | 其他工具结果 | 其他 `*_tool_result`（如 code execution 等） |
| `container` | 容器信息 | 响应顶层 `container`（若有） |

其中，**`web_search_results`** 是「OpenAI 风格消息 → Anthropic 消息」时重建服务端工具链的关键：OpenAI 风格里没有「web_search_tool_result」这种 content 块，这些结果被保存在 assistant 消息的 `provider_specific_fields.web_search_results` 中。

### 9.4 在本 provider 中的功能（读取与重建）

本 provider 在 **`mapAssistantMessage()` / `mapAssistantToolCalls()`** 中处理 assistant 的 `tool_calls` 时，需要把 OpenAI 风格的 tool call 转成 Anthropic 的：

- **普通 tool**：`tool_use`（`ToolUseBlockParam`）
- **服务端 tool**（如 web search）：`server_tool_use` + 对应的 `web_search_tool_result`（或 `web_fetch_tool_result`）块

Anthropic 要求在同一轮 assistant 的 content 中，每个 `server_tool_use` 后面可以紧跟对应的 `*_tool_result` 块；而 OpenAI 风格只有 `tool_calls` 数组，没有这些 result 块。因此：

1. **从当前 assistant 消息上读取** `provider_specific_fields`（若存在）；
2. 从中取出 **`web_search_results`**（即之前上游从 Anthropic 响应里解析并写入的 `web_search_tool_result` / `web_fetch_tool_result` 列表）；
3. 在将 `tool_calls` 转为 Anthropic 的 tool use / server tool use 时：
   - 对 `id` 以 `srvtoolu_` 开头的 tool call，生成 `server_tool_use` 块；
   - 用 `web_search_results` 中 `tool_use_id === tool.id` 的项，在对应 `server_tool_use` 之后追加 `web_search_tool_result`（或 `web_fetch_tool_result`）块，从而**完整重建 Anthropic 所需的多轮服务端工具结构**。

若不读取 `provider_specific_fields.web_search_results`，则多轮对话中上一轮模型发出的 web search 等服务端工具结果会丢失，无法在再次请求 Anthropic 时正确还原对话状态（与 LiteLLM 的 [BerriAI/litellm#17737](https://github.com/BerriAI/litellm/issues/17737) 所修问题一致）。

### 9.5 实现约定（本库）

- **类型**：assistant 消息上可选的 `provider_specific_fields` 在类型上应视为 `Record<string, unknown> | undefined`；读取 `web_search_results` 时做存在性及数组类型校验。
- **位置**：在 `mapAssistantMessage()` 中处理 `tool_calls` 时，从当前 `msg` 上取 `provider_specific_fields`，将 `web_search_results` 传入 `mapAssistantToolCalls()`（或等价逻辑），用于在生成 `server_tool_use` 的同时追加对应的 result 块。
- **兼容性**：若消息来自不写入 `provider_specific_fields` 的上游，或未包含 `web_search_results`，则仅生成 `server_tool_use`，不追加 result 块，行为与「无 result 可附」一致。

---

## 关键类型与实现位置

- OpenAI 类型：`packages/ada-pter/src/types/openai/completions/`（`params.d.ts`、`shared.d.ts`、`extend.d.ts`）
- Anthropic 类型：`packages/providers/anthropic/src/types/messages.d.ts`
- 映射实现：`packages/providers/anthropic/src/map-messages.ts`

### `map-messages.ts` 内部函数索引

| 函数 | 用途 |
| --- | --- |
| `extractSystem()` | 抽离 system/developer 消息为 `TextBlockParam[]` |
| `mapMessages()` | 合并相邻同类消息，分发到 user/assistant 映射 |
| `mapContentPart()` | user 消息的 content part 映射（text、image_url、file） |
| `mapImagePart()` | 图片 URL / data URL 解析 |
| `mapToolOrFunctionMessage()` | tool/function 消息转为 `tool_result` block |
| `mapUserLikeMessage()` | user/tool/function 消息统一入口 |
| `mapAssistantMessage()` | assistant 消息转换主函数 |
| `mapAssistantContentArray()` | assistant content 数组逐项处理 |
| `mapAssistantToolCalls()` | tool_calls 转为 `ToolUseBlockParam` / `server_tool_use`；可接收 `provider_specific_fields.web_search_results` 以重建 `web_search_tool_result` 块 |
| `mapAssistantFunctionCall()` | 旧格式 function_call 转为 `ToolUseBlockParam` |
| `parseToolArguments()` | 安全解析 tool call 的 JSON arguments |
| `generateToolId()` | 生成 tool use id（UUID 或随机回退） |
| `mergeCacheControl()` | 透传 `cache_control` 字段 |
| `trimFinalAssistantWhitespace()` | 去除最后一条 assistant 消息的尾部空白 |

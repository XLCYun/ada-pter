# Anthropic Provider 适配


## 请求的转换

### 思考程度的配置

Anthropic 使用两个参数来决定思考程度：
```typescript
output_config.effort = "low" | "medium" | "high" | "max" | null;
thinking = 
    | { type: "disabled" }
    | { type: "adaptive" }
    | { type: "enabled"; budget_tokens: number }
```

其中 effort 只有 opus 4.5, opus 4.6 开始有的。

OpenAI 使用
```typescrip
reasoning_effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | null
```

如何决定 thinking 参数：
1. 如果透传了该参数，则直接使用
2. 如果未传 reasoning_effort，或传了 "none" | null，则 thinking 不取值
3. 如果是 opus 4.6，返回 { type: "adaptive" }
4. 其余情况返回 { type: "enabed", budget_tokens }, budget_tokens 取值为：
   1. minimal => 128
   2. low => 1024
   3. medium => 2048
   4. high => 4096
   5. xhigh => 4096

如何决定 output_config.effort：
1. 如果透传了该参数，则直接使用
2. 如果不是 opus 4.5, opus 4.6 则不设置 effort
3. 如果 reasoning_effort = falsy | "none"，则不设置 effort
4. 否则返回effort
   1. minimal => low
   2. low => low
   3. medium => medium
   4. high => high
   5. xhigh: opus 4.6 ? max : high

TODO: 实现透传

### 工具映射
```typescript
OpenAI:
    {
        type: "function",
        function: {
            name: string
            description?: string
            parameters: Record<string, unknown>
        }
    } | {
        type: "custom",
        custom: {
            name: string
            description?: string
            format: { type: "text" } | {
                type: "grammar",
                grammar: { syntax: "lark" | "regex", definition: string }
            }
        }
    }
Anthropic:
{
      type?: "custom" | null;
      input_schema: {
        type: "object";
        properties?: unknown | null;
        required?: Array<string> | null;
        [k: string]: unknown;
      }
      name: string;
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      description?: string;
      eager_input_streaming?: boolean | null;
      input_examples?: Array<{ [key: string]: unknown }>;
      strict?: boolean;
    }
```

注意：
1. OpenAI 只支持 `function`, `custom` 两种工具，这两种都可以直接映射为 Antropic 的 custom 工具
2. Anthropic 的 custom 工具的 input_schema 只能传 type, properties, required 三个字段。OpenAI 则无此限制。

1. 如果直接透传了 Anthropic 工具，则直接使用
2. type = `function`
   1. name = tool.function.name
   2. description = tool.function.description
   3. input_schema = { tool.function.parameters 保留 type, properties, required }
3. type = `custom`
   1. name = tool.custom.name
   2. description: tool.custom.description
   3. input_schema: { type: "object", properties: {} }

TODO: 实现透传

### Messages 映射

注意：
- Anthropic 只有 system, user, assistant 三种 roles
- OpenAI 有 system, developer, user, assistant, tool, function 六种 roles
- roles 的映射：
  - system, developer => system
  - assistant => assistant
  - user, tool, function => user
- Anthropic 将 system 消息，单独放到 body.system 字段中。因此在映射 messages 时，保持 user, assistant, user, assistant... 的次序
- 带 thinking blocks 时，content 数组的第一个必须是一个 thinking block
- 第一个消息必须是 user 消息（system消息已经用 system 参数单独传）
- Anthropic Assistant 消息，如果是 server tool + thinking 的多轮思考，则顺序需要保持不变

system 消息映射：
1. 从消息列表中过滤出role为system和developer的消息
2. system和developer消息都是文本消息，Anthropic它的system消息也只支持文本消息。直接转换即可。

其它消息映射的基本思路
1. 对于相邻的user, tool, function消息，把它们打包为一个anthropic的user消息
2. 对于相邻的assistant消息，把它们打包为一个Anthropic的assistant消息
3. 打包方法是将相邻的消息，映射为一个 content，组装成 anthropic 的 message.content 数组

assistant 消息 => 多个 content block，由四部分组成：
1. thinking blocks
   1. 如果 msg.thinking_blocks 存在，则放在开头，这是 anthropic 要求的
2. content blocks
   1. 如果 msg.content 是字符串 => { type: "text", text: content }
   2. 如果 msg.content 是数组，则展开，OpenAI 只支持 text, refusal 两类 content type，两者都直接映射为 text 类型；如果是其它 Anthropic 的透传原生 content，则直接透传
   3. 处理 msg.tool_calls，需要映射为 tool_use 或 server_tool_use 消息
   4. 处理 msg.function_call，映射为 tool_use

TODO: 添加直接恢复 anthropic 原始 Assistannt 消息的功能

user, tool, function 消息的处理，其中 tool, function 的映射如下：
```typescript
{
    role: "tool";
    tool_call_id: string;
    content: ({ text: string; type: "text" } & CacheControlEphemeral)[] | string
} | {
    role: "function";
    name: string;
    content: string | null;
}
=>
{
    type: "tool_result";
    tool_use_id: string;
    content?: 
      | string
      | TextBlockParam
    cache_control?: CacheControlEphemeral | null;
}
```

对 user 消息的处理：
1. 如果 content 是 string，则直接映射为 { type: "text", content: string }
2. 如果 content 是数组，则遍历映射其中的元素：
  1. OpenAI 的 user content 实际上只支持 text, image_url, input_audio, file 类型
  2. Anthropic 不支持 input_audio
  3. text 直接转换
  4. image_url => { type: "image", source: { type: "url", url } } 或者 { type: "base64", "media_type", data }
  5. file: 转换规则见下。

OpenAI 的 file content 结构如下：
```typescript
{
  type: "file",
  file: {
    file_id?: string;
    filename?: string;
    file_data?: string;
  }
}
```

可供选择的 Anthropic Content Block：
```typescript
{ type: "url": url: string }
{ type: "base64", media_type: "application/pdf" }
{ type: "text", media_type: "text/plain"}
{ type: "content", content: string | (
    | { type: "text", text: string }
    | { 
      type: "image"
      source: { type: "base64", media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }
      | { type: "url", url: string }
    }
  )[]
}
```

### 其它字段的映射

Messages、工具、思考程度的映射已在上文详述，其余字段映射规则如下：

- `model` → `model`（直接透传）
- `max_completion_tokens` / `max_tokens` → `max_tokens`（优先取 `max_completion_tokens`，均未传时默认 4096）
- `temperature` → `temperature`
- `top_p` → `top_p`
- `top_k` → `top_k`（OpenAI 扩展字段，Anthropic 原生支持）
- `stop` → `stop_sequences`（字符串自动包装为数组）
- `stream` → `stream`
- `cache_control` → `cache_control`（OpenAI 扩展字段，直接透传）
- `metadata.user_id` → `metadata.user_id`（仅透传 `user_id` 字段，其余 metadata 丢弃）
- `tool_choice` → `tool_choice`（详见下方）
- `parallel_tool_calls` → `tool_choice.disable_parallel_tool_use`（取反后合并到 `tool_choice` 对象）
- `response_format` → `output_config.format`（详见下方）
- `service_tier` → `service_tier`（详见下方）
- `web_search_options` → 追加 `web_search_20250305` 工具（详见下方）

以下字段在 Anthropic 中**无对应支持，直接丢弃**：
`n`、`seed`、`frequency_penalty`、`presence_penalty`、`logit_bias`、`logprobs`、`top_logprobs`、`store`、`audio`、`modalities`、`prediction`、`safety_identifier`、`verbosity`、`prompt_cache_key`、`prompt_cache_retention`、`user`

#### `tool_choice` 映射

| OpenAI                                     | Anthropic                |
| ------------------------------------------ | ------------------------ |
| `"auto"`                                   | `{ type: "auto" }`       |
| `"required"`                               | `{ type: "any" }`        |
| `"none"`                                   | `{ type: "none" }`       |
| `{ type: "function", function: { name } }` | `{ type: "tool", name }` |
| `{ type: "custom", custom: { name } }`     | `{ type: "tool", name }` |
| `{ type: "allowed_tools", ... }`           | 不支持，丢弃             |

#### `response_format` 映射

映射到 `output_config.format`，同时自动添加 `anthropic-beta: structured-outputs-2025-11-13` 请求头：

| OpenAI `response_format`                           | Anthropic `output_config.format`                      |
| -------------------------------------------------- | ----------------------------------------------------- |
| `{ type: "text" }` 或未传                          | 不设置                                                |
| `{ type: "json_object" }`                          | `{ type: "json_schema", schema: { type: "object" } }` |
| `{ type: "json_schema", json_schema: { schema } }` | `{ type: "json_schema", schema }`                     |
| `json_schema` 但 `schema` 为空                     | 不设置                                                |

#### `service_tier` 映射

| OpenAI `service_tier`               | Anthropic `service_tier` |
| ----------------------------------- | ------------------------ |
| `"default"` / `"flex"`              | `"standard_only"`        |
| `"auto"` / `"scale"` / `"priority"` | `"auto"`                 |
| `null` / 未传                       | 不设置                   |

#### `web_search_options` 映射

若传入 `web_search_options`，则在 `tools` 数组末尾追加 Anthropic 的 `web_search_20250305` 工具，并自动添加 `anthropic-beta: web-search-2025-03-05` 请求头。`web_search_options` 中的 `search_context_size` 和 `user_location` 字段直接映射到该工具的对应字段。


## 响应的转换

Anthropic 中没有 choices 的概念，相当于只会返回一个 choice。因此我们把 Anthropic 响应中的内容转换为一个 choice。

与 OpenAI 不同的是，Anthropic 中的 content 是一个 ContentBlock 数组，因此我们需要把 ContentBlock 数组中的内容整合为 OpenAI 中的 choices[0].message 结构体。

### 文本 ContentBlock

```typescript
{
    type: "text";
    text: string;
    citations: null | Citation[];
}
```

将所有的文本 ContentBlock 中的 text 文本拼起来，做为 message.content 字段。

这里的 citations 是归属这个文本 ContentBlock 的 text 文本的，把它保存为 citations[*].supported_text，以此来记录这个关联信息。

### Tool Use 块和 Server Tool Use 块

```typescript
{
    type: "tool_use";
    id: string;
    name: string;
    input: unknown;
    caller: Caller
} | {
    type: "server_tool_use";
    id: string;
    name:
        | "web_search"
        | "web_fetch"
        | "code_execution"
        | "bash_code_execution"
        | "text_editor_code_execution"
        | "tool_search_tool_regex"
        | "tool_search_tool_bm25";
    input: unknown;
    caller: Caller;
}
```

需要转换为 OpenAI  choices[0].tool_calls 元素：

```typescript
{
    type: "function";
    id: string;
    function: {
        arguments: string;
        name: string;
    }
}
```

### Tool Result 类的块

这些工具结果实际上是 anthropic 自己调用内部工具的结果，因此在 OpenAI 的 message 结构体中并没有地方保存工具结果的字段。

`有以下类型：`

- web 工具
  - web_search_tool_result
  - web_fetch_tool_result
- Anthropic 内部的工具搜索工具
  - tool_search_tool_result
- code_execution_tool_result
- bash_code_execution_tool_result
- text_editor_code_execution_tool_result

对于 tool_search_tool_result 是内部的【工具搜索工具】的结果，直接忽略。

对于 web 工具，保存到 `choices[0].message.provider_specific_fields.web_search_results` 中

对于其它工具结果，保存到 `choices[0].message.provider_specific_fields.tool_results` 中

在多轮对话中，`web_search_results` 会在 `map-messages.ts` 的 `mapAssistantToolCalls()` 里被读回，用于重建 Anthropic 所需的 `server_tool_use` + `web_search_tool_result` 块，因此确实依赖 `provider_specific_fields`。关于切换模型：

- 切换 **Anthropic 模型**（如 claude-3-5-sonnet → claude-3-7-sonnet）：**不会丢失**，`provider_specific_fields` 挂在历史消息对象上，与请求时使用的模型无关，只要上游在构建多轮历史时原样带入即可。
- 切换到**非 Anthropic 模型**（如 OpenAI GPT）：**会丢失**，但属于预期行为——Anthropic server tool（web search 等）是 Anthropic 专有功能，其他模型不支持，丢失这些结果是合理的。

### Container Upload 块

```typescript
{
    type: "container_upload";
    file_id: string;
}
```

Anthropic 将某个文件上传到沙箱容器中。

保存到 `choices[0].message.provider_specific_fields.container_upload 中。`

### Thinking & Reducted Thinking 块

```typescript
{
    type: "thinking";
    thinking: string;
    signature: string;
} | {
    type: "redacted_thinking";
    data: string;
}
```

thinking 块是明文思考内容，而 redacted_thinking 中的 data 是加密后转为 base64 编码的字符串。

这两个块，会统一保存到到数组 thinking_blocks，然后保存在：

1. choices[0].message.provider_specific_fields.`thinking_blocks`
2. choices[0].message.thinking_blocks 中

对于 thinking 块，取出其中的 thinking 思考字符串拼合起来，做为 reasoning_content，然后保存在：

1. choices[0].message.provider_specific_fields.reasoning_content 中

## 流式响应的转换

OpenAI 的 Chunk 只有一种类型结构定义：

```typescript
export interface ChatCompletionChunk {
  id: string;
  choices: {
    delta: {
      role?: "developer" | "system" | "user" | "assistant" | "tool";
      content?: string | null;
      refusal?: string | null;
      function_call?: {
        arguments?: string;
        id?: string;
        name?: string;
      };
      tool_calls?: {
        index: number;
        type?: "function";
        function?: {
          arguments?: string;
          name?: string;
        };
      }[]

      // add thinking blocks and reasoning content support
      thinking_blocks?: ThinkingBlock[];
      reasoning_content?: string | null;
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | null;
    index: number;
    logprobs?: ChatCompletionChunkChoiceLogprobs | null;
  }[];
  created: number;
  model: string;
  object: "chat.completion.chunk";
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;
  system_fingerprint?: string;
  usage?: CompletionUsage | null;
}
```

对于上层消费 chunk 的用户而言，需要做的主要工作就是拼接 choices 数组。

对于我们适配层，我们就是将每一个 anthropic event 都转换为一个只有一个 choice 的 ChatCompletionChunk 结构并返回，上层消费的用户做的主要工作仍然是拼接 choices 数组。

与 OpenAI 不同，Anthropic 走的是 Stream Event 的设计，我们收到的每一个 chunk 可能是不同 Event，不同 Event 的数据结构不同：

```typescript
export type RawMessageStreamEvent =
  | RawMessageStartEvent
  | RawMessageDeltaEvent
  | RawMessageStopEvent
  | RawContentBlockStartEvent
  | RawContentBlockDeltaEvent
  | RawContentBlockStopEvent
  | RawErrorEvent;
```

具体见 `types.responses.md`。

这些事件的设计如下：

1. RawMessageStartEvent 用于告知一个消息的开始
  1. RawContentBlockStartEvent：告知一个 content block 的开始
  2. RawContentBlockDeltaEvent：补充某一个 content block 的内容，例如 index=2 的 Content Block 的 文本 delta
  3. RawContentBlockStopEvent：告知一个 content block 的结束
2. RawMessageDeltaEvent 用于给一个消息打补丁，通常用于报告 usage，使用的 container 等。
3. RawMessageStopEvent：告知一个消息的结束
4. RawErrorEvent：告知一个错误

在处理一整个流式消息时，我们会维护一个 StreamState 状态，它包含以下字段：

1. `id`: 消息 id，来自于 RawMessageStartEvent.message.id
2. `model`: 消息模型，来自于 RawMessageStartEvent.message.model
3. `created`: 创建 State 时的时间戳，由 Date.now() 计算得到
4. `toolIndex`: 当前工具索引，初始为 -1，每次遇到 tool_use 或 server_tool_use 块时加 1
5. `currentContentBlockType`: 当前 content block 类型，初始为 null，每次遇到 content block 块时设置
6. `currentToolCallArgsLength`: 当前工具调用参数长度，初始为 0，每次遇到 tool_use 或 server_tool_use 块时累加
7. `webSearchResults`: 当前 web 搜索结果，初始为空数组，每次遇到 web_search_tool_result 或 web_fetch_tool_result 块时添加
8. `toolResults`: 当前工具结果，初始为空数组，每次遇到 tool_search_tool_result 或 code_execution_tool_result 或 bash_code_execution_tool_result 或 text_editor_code_execution_tool_result 块时添加
9. `reasoningContent`: 当前 reasoning content，初始为空字符串，每次遇到 thinking 或 redacted_thinking 块时累加

### RawErrorEvent

直接抛出一个错误。

### RawMessageStartEvent

1. 将消息 id 处理设置为 StreamState.id
2. 将消息模型处理设置为 StreamState.model
3. 将消息使用情况处理设置为 StreamState.usage
  1. 虽然当前还没有开始输出，但是我们的输入已经产生了 input usage
4. 构建并返回一个只有一个 choice 的 ChatCompletionChunk 结构

在消息开始时，通常不会带有 content block，因此不需要做这部分的处理。

### RawContentBlockStartEvent

根据 content typ 来 yield

```typescript
yield { id, object, created, model, choices[{ index: 0, finish_reason, delta: <Delta块> }] }
```

根据 content type 来决定 Delta 块：

1. StreamState.currentContentBlockType = event.content_block.type
2. 如果当前块类型是文本块，{ content: block.text }
3. 如果是 tool_use, server_tool_use，记录 StreamState.toolIndex++, 返回 { tool_calls: [ { index, type: "function", id?, function: { name?, arguments: "" } } ]  }，此时使用的 arguments 先使用空字符串。后端真实的参数，会通过 content_block_delta 事件来传递
4. 如果是 redacted_thinking，yield { thinking_blocks: [{ type: "redacted_thinking", data: block?.data ?? "" , provider_specific_fields: { thinking_blocks: thinkingBlocks }}]}
5. 如果是 _tool_result
  1. tool_search_tool_result：anthropic 内部工具调用结果，忽略此事件
  2. web_search_tool_result/web_fetch_tool_result
    1. state.webSearchResults.push(block)
    2. yield { provider_specific_fields: { web_search_results: state.webSearchResults } } **这里把 web 工具保存到 provider_specific_fields 里了，因此请求时，需要从 message.provider_specific_fields 中恢复这些工具结果**
  3. 其余的工具类型
    1. state.toolResults.push(block);
    2. yield { provider_specific_fields: { tool_results: state.toolResults } }
    3. 注意：每次返回的是累积数组的引用（而非仅新增项），这是有意为之——上游消费流式 chunk 时会用后来的 `provider_specific_fields` 覆盖前值，因此每次带上完整数组可确保最终消费方拿到完整的工具结果列表，与非流式行为一致。
6. 忽略此事件

### RawContentBlockDeltaEvent

处理内容块的增量更新。包含 `delta` 字段，根据其 `type` 分别处理：

1. **text_delta**：文本内容增量
  - yield { content: delta.text }
2. **input_json_delta**：工具调用参数的 JSON 增量（仅在 tool_use / server_tool_use 中出现）
  - yield { tool_calls: [{ index: toolIndex, type: "function", function: { arguments: partial_json } }] }
  - 追踪累积的参数长度到 `currentToolCallArgsLength`
3. **citations_delta**：引用信息增量
  - yield { provider_specific_fields: { citation: delta.citation } }
4. **thinking_delta / signature_delta**：思考过程或签名增量
  - 组装 ThinkingBlock，包含 thinking 和 signature 字段
  - yield { thinking_blocks, reasoning_content, provider_specific_fields: { thinking_blocks } }
  - 将 thinking 内容累积到 `reasoningContent`

### RawContentBlockStopEvent

1. 如果不是 tool_use, server_tool_use，重置 state.currentContentBlockType 为 null
2. 如果是 tool_use, server_tool_use，并且之前没有输出过参数， yeild { tool_calls: [ { index, type: "function", function: { arguments: "{}" } } ]  }

### RawMessageDeltaEvent

在流式末尾附近出现，用于携带**该条 assistant 消息的汇总增量**（`delta`）与**最终用量**（`usage`）。`handleMessageDelta` 会产出一块 `ChatCompletionChunk`，其中：

1. `finish_reason`：由 `event.delta.stop_reason` 经 `mapFinishReason` 映射为 OpenAI 风格
2. `usage`：将事件上的 `usage` 交给 `mapUsage`，并与 state.reasoningContent 一起计算 OpenAI 风格的 `CompletionUsage`
3. `choices[0].delta: {}`

### RawMessageStopEvent

不做处理。

## 某些特定结构的转换

### 对 OpenAI Message / Delta 的扩展

添加了以下字段：

1. thinking_blocks 用于保存思考块
2. reasoning_contents 用于保存整体的思考字符串

另外 ada-pter/anthropic 内部添加了：

1. provider_specific_fields：目前暂时先限定在此 provider 中，后面看是否要提升为核心类型，不同 provider 可写入自己的一些字段

### provider_specific_fields

类型定义（`response-shared.ts`）：

```typescript
export type ProviderSpecificFields = {
  /** 非流式：按 text segment 分组的引用信息（附加 supported_text）。 */
  citations?: (Citation & { supported_text: string })[][];
  /** 流式：单条增量 citation（来自 citations_delta）。 */
  citation?: Citation;
  thinking_blocks?: ThinkingBlock[];
  web_search_results?: (WebSearchToolResultBlock | WebFetchToolResultBlock)[];
  tool_results?: (
    | CodeExecutionToolResultBlock
    | BashCodeExecutionToolResultBlock
    | TextEditorCodeExecutionToolResultBlock
    | ToolSearchToolResultBlock
  )[];
  container_uploads?: ContainerUploadBlock[];
};
```

- 流式中，它从各个 event 中取出，被挂在 `choices[0].delta.provider_specific_fields` 中
- 非流式中，它从 anthropic message 根字段和 message.content[] 中取出数据，拼合后挂到 `choices[0].message.provider_specific_fields` 中

**流式（`response-stream.ts`）**

- `thinking_block`（`redacted_thinking`）：`content_block_start` 时，将 `{ type: "redacted_thinking", data }` 推入 `delta.thinking_blocks` 与 `delta.provider_specific_fields.thinking_blocks`
- `thinking_delta` / `signature_delta`：`content_block_delta` 时，构造 `ThinkingBlock`，追加到 `delta.thinking_blocks` 与 `delta.provider_specific_fields.thinking_blocks`；`thinking` 文本同步累积到 `state.reasoningContent`
- `citations_delta`：`content_block_delta` 时，将单条 `citation` 写入 `delta.provider_specific_fields.citation`
- `web_search_tool_result` / `web_fetch_tool_result`：`content_block_start` 时，push 到 `state.webSearchResults`，并将整个数组写入 `delta.provider_specific_fields.web_search_results`
- `tool_search_tool_result`：跳过，不输出
- 其余 `*_tool_result`：push 到 `state.toolResults`，写入 `delta.provider_specific_fields.tool_results`

**非流式（`response-shared.ts` + 调用方）**

- `citations`：从 text block 的 `citations` 字段收集，按 text segment 分组，附加 `supported_text`，写入 `provider_specific_fields.citations`
- `thinking_blocks`：从 `thinking` / `redacted_thinking` content block 收集，写入 `provider_specific_fields.thinking_blocks`
- `web_search_tool_result` / `web_fetch_tool_result`：从 content 数组收集，写入 `provider_specific_fields.web_search_results`
- 其余 `*_tool_result`（code execution、bash、text editor、tool search）：收集到 `provider_specific_fields.tool_results`
- `container_upload`：从 content 数组收集，写入 `provider_specific_fields.container_uploads`
- 最终挂在 `choices[0].message.provider_specific_fields`

### 思考推理结果

- reasoning_content
- thinking_blocks
- redacted_thinking_blocks

reasoning_content 是由 thinking 块中的 thinking 字段思考内容拼合来的。它会保存到：

1. 非流式中的 `choices[0].message.reasoning_content` 中
2. 流式的 `delta.reasoning_content` 中

它最后会被用来计算 usage。

**关于 `redacted_thinking` 对 usage 准确性的影响：**

- `completion_tokens` / `prompt_tokens` / `total_tokens` **不受影响**——这三个字段直接取自 Anthropic 服务端返回的 `usage.output_tokens` / `usage.input_tokens`，是服务端统计值，包含了所有输出 token（含 thinking、redacted_thinking、text 等块）。
- `completion_tokens_details.reasoning_tokens` **会偏低**——该字段通过对 `reasoningContent`（仅由 `thinking` 块文本拼接）调用 `countReasoningTokens()` 近似计算得出。`redacted_thinking` 块只有不透明的 `data` 字段，无可读文本，因此被跳过，导致存在 `redacted_thinking` 时 `reasoning_tokens` 少算了对应的 token 数。此外，`countReasoningTokens` 使用的是 `cl100k_base`（GPT 系列 tokenizer），与 Anthropic 自身的 tokenizer 不同，即使对 `thinking` 块也只是近似值。

目前 Anthropic API 未在 `usage` 中直接提供 `thinking_tokens` 字段，若需更准确的 `reasoning_tokens`，只能等待 API 侧支持。

### container 相关字段

目前有两个：

```typescript
interface Container {
    id: string;
    expires_at: string;
}
interface ContainerUploadBlock {
    type: "container_upload";
    file_id: string;
}
```

1. 响应中的 container_upload ContentBlock
2. 请求参数中的 container 字段

处理：

1. container
  1. 在请求参数中，我们目前并没有传 container，因为OpenAI中没有相应的参数，如果需要传的话，可能需要使用透传
2. container upload
  1. 在请求参数中，如果OpenAI的 user 消息有 file content, 那么会被映射为 Anthropic 的 container upload content block
  2. 在非流式响应中，如果遇到container upload content, 则会被收集到provider specific fields
  3. Antropic message 顶层字段有container字段，但是并没有做处理

**FIXME：** `container_uploads` 收集后从未被消费——多轮对话重建 assistant 消息时这些块会丢失。且由于收集时用 `filter` 按类型分桶，原始在 content 数组中的位置已无法恢复，即便补充重建逻辑也只能追加到末尾，无法还原原序。如需正确支持，应保存完整的原始 content 数组（或位置索引）。

### Usage 的计算与处理

Anthropic 的 Usage 格式：

```typescript
export interface Usage {
  cache_creation: {
    ephemeral_1h_input_tokens: number;
    ephemeral_5m_input_tokens: number;
  } | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;

  input_tokens: number;
  output_tokens: number;
  
  inference_geo: string | null;
  server_tool_use: {
    web_fetch_requests: number;
    web_search_requests: number;
  } | null;
  service_tier: "standard" | "priority" | "batch" | null;
}
```

OpenAI 的 Usage 格式：

```typescript
export interface CompletionUsage {
  total_tokens: number;

  completion_tokens: number;
  completion_tokens_details?: {
    accepted_prediction_tokens?: number;
    audio_tokens?: number;
    reasoning_tokens?: number;
    rejected_prediction_tokens?: number;
  };

  prompt_tokens: number;
  prompt_tokens_details?: {
    audio_tokens?: number;
    cached_tokens?: number;
  };
  /** Server tool use counts; used by Anthropic and others. */
  server_tool_use?: {
    web_search_requests?: number;
    tool_search_requests?: number;
  };
}
```

1. prompt_tokens = usage.input_token + cache_creation_input_tokens + usage.cache_read_input_tokens
2. prompt_tokens_detail 里只有 cached_tokens 可以计算等于 usage.cache_read_input_tokens
3. completion_tokens = usage.output_tokens
4. completion_tokens_detail 里，只有 reasoning_tokens 可以计算
5. total_tokens = prompt_tokens + completion_tokens
6. reasoning_tokens  = 如果有 reasoningContent，则使用 tiktoken 进行计算
7. server_tool_use = usage.server_tool_use


### finish reason 的映射

```typescript
Anthropic: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | "pause_turn" | "refusal";
OpenAI: "stop" | "length" | "tool_calls" | "content_filter" | "function_call"
```

1. 如果没有给具体的停止原因，返回 stop
2. stop_sequence => stop
3. max_tokens => length
4. tool_use => tool_calls
5. refusal => content_filter
6. other: pause_turn, end_turn => stop


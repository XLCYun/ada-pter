# Anthropic Provider 适配

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

`这些工具结果实际上是 anthropic 自己调用内部工具的结果，因此在 OpenAI 的 message 结构体中并没有地方保存工具结果的字段。`

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

TODO: 工具结果是否依赖从 `provider_specific_fields 中恢复出来，如果是的话，切换了模型之后这些工具结果就丢失了吗？`

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

这两个块，会统一保存到到数组 thinking_blocks，然后保存为 ``choices[0].message.provider_specific_fields.`thinking_blocks`。

对于 thinking 块，取出其中的 thinking 思考字符串拼合起来，做为 reasoning_content，然后返回。它最后会被保存到`choices[0].message.reasoning_content` 中。

## 流式响应的转换

## 某些特定结构的转换

### provider_specific_fields

- 流式中，它从各个 event 中取出，被挂在 `choices[0].delta.provider_specific_fields` 中
- 非流式中，它从 anthropic message 根字段和 message.content[] 中取出数据，拼合后挂到 `choices[0].message.provider_specific_fields` 中

TODO：补充更详细的处理细节

### 思考推理结果

- reasoning_content
- thinking_blocks
- redacted_thinking_blocks

reasoning_content 是由 thinking 块中的 thinking 字段思考内容拼合来的。它会保存到：

1. 非流式中的 `choices[0].message.reasoning_content` 中
2. 流式的 `delta.reasoning_content` 中

它最后会被用来计算 usage。

TODO: 由于忽略了 redacted_thinking，最后计算的 usage 是否根本就不准？

### container


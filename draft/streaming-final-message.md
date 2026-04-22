# Streaming Final Message — 实现方案

## 背景

当前 ada-pter 的流式模式 (`stream: true`) 只逐个 yield `ChatCompletionChunk`，流结束后用户无法从同一个对象获取完整的 `ChatCompletion`。需要为流式返回的 AsyncIterable 附加 `finalMessage` Promise 属性，使流结束后可获取合并后的完整消息。

---

## 核心设计

### 类型定义

新增 `StreamingCompletionResult` 类型，扩展 `AsyncIterable<CompletionChunk>`：

```typescript
interface StreamingCompletionResult extends AsyncIterable<CompletionChunk> {
  /** Promise that resolves to the merged ChatCompletion after stream ends */
  readonly finalMessage: Promise<CompletionResponse>;
}
```

### `completion()` 方法签名变更

```typescript
// 之前
completion(params: CompletionRequest & { stream: true }): AsyncIterable<CompletionChunk>;

// 之后
completion(params: CompletionRequest & { stream: true }): StreamingCompletionResult;
```

---

## 实现位置

### 1. 合并逻辑 — 新文件 `packages/ada-pter/src/core/merge-chunks.ts`

核心函数 `mergeChunks(chunks: ChatCompletionChunk[]): ChatCompletion`：

- 从第一个 chunk 取 `id`, `model`, `created`, `service_tier`, `system_fingerprint`
- 遍历所有 chunk 的 `choices`，按 `index` 分组合并：
  - **content**: 拼接所有 `delta.content`
  - **tool_calls**: 按 `(choiceIndex, toolCall.index)` 分组，拼接 `function.arguments`，取第一个非空的 `id` 和 `function.name`
  - **function_call**: 拼接 `arguments`，取第一个非空的 `name`
  - **refusal**: 取最后一个非空值
  - **role**: 取第一个非空值（应为 `"assistant"`）
  - **thinking_blocks**: 收集所有非空数组并 flatten
  - **reasoning_content**: 拼接所有增量值
  - **finish_reason**: 取最后一个非 `null` 值
  - **logprobs**: 取最后一个非空值
- **usage**: 取最后一个非空值
- **object**: 设为 `"chat.completion"`

### 2. `StreamingResult` 包装 — 新文件 `packages/ada-pter/src/core/streaming-result.ts`

函数签名：`createStreamingResult(source, mergeFn) → StreamingCompletionResult`

**核心架构：Eager Background Consumer + 共享 Buffer**

- 数据流：`source stream → [background consumer] → shared chunks[] → user iterator / finalMessage`
- Background consumer 在 `createStreamingResult` 调用时**立即启动**，不依赖用户是否迭代

**实现要点：**

- 维护共享状态：
  - `chunks[]` — 累积所有已收到的 chunk
  - `done: boolean` — source 是否已消费完毕
  - `streamError: Error | null` — 捕获的错误
  - `waiters[]` — 等待新数据的 resolve 回调队列
- `finalMessage` Promise：由手动 `resolve/reject` 控制
- Background consumer（IIFE，立即执行）：
  - `for await (chunk of source)` 拉取每个 chunk
  - 每收到一个 chunk：push 到 `chunks[]`，shift 并调用一个 waiter 通知 iterator
  - 正常结束：设 `done = true`，调用 `mergeChunks(chunks)` 后 resolve `finalMessage`
  - 异常：设 `streamError` 和 `done = true`，reject `finalMessage`
- Generator（返回给用户的 AsyncIterable）：
  - 循环：先 yield `chunks[i++]` 中所有未读 chunk
  - buffer 读完且 `done` → 正常 return 或 throw error
  - buffer 读完但未 done → `await new Promise(r => waiters.push(r))` 等待通知
- 最终：通过 `Object.defineProperty` 将 `finalMessage` 挂到 generator 对象上

**为什么不用简单的 passthrough generator：**

简单 passthrough（用户迭代时顺便收集 chunk）无法处理"用户只 await finalMessage 不迭代"的场景——generator 不消费，source 不拉取，finalMessage 永远不 resolve。Eager background consumer 确保无论用户是否迭代，source 都会被完整消费。

### 3. `adapter.ts` — `executeAsStream` 改造

- `executeAsStream` 不再是 `async *generator`，改为普通 `async` 方法，返回 `createStreamingResult` 的结果
- 空 stream 时返回空 generator：`(async function* () {})()`
- 目前 `executeAsStream` 是泛型方法（completion / image / speech 共用），暂不对其他 API 类型加 finalMessage，类型层面通过 completion 的重载签名保证

### 4. `completion()` 方法重载更新

- `stream: true` 重载返回 `StreamingCompletionResult`
- `stream?: false | undefined` 重载返回 `Promise<CompletionResponse>`（不变）

---

## 各场景分支处理

### 场景 1: 正常文本生成

- Chunks: `[{ role: "assistant" }, { content: "Hello" }, { content: " world" }, { finish_reason: "stop", usage: {...} }]`
- 合并结果: `{ choices: [{ message: { role: "assistant", content: "Hello world" }, finish_reason: "stop" }], usage: {...} }`

### 场景 2: Tool calls

- Chunks 中有多组 `delta.tool_calls`，每个 tool call 的参数分多次到达
- 按 `(choiceIndex, toolCall.index)` 分组拼接 `function.arguments`
- 最终合成完整的 `tool_calls` 数组

### 场景 3: 多 choice (n > 1)

- 不同 chunk 的 `choices[].index` 不同
- 按 `choice.index` 分组合并，每组独立处理 content / tool_calls 等

### 场景 4: Thinking / Reasoning

- `thinking_blocks`: 收集所有 chunk 中的 thinking_blocks 数组并 flatten
- `reasoning_content`: 每个 chunk 中为增量值，字符串拼接所有 `delta.reasoning_content`

### 场景 5: 流中途报错

- generator 内 try/catch 捕获错误
- `finalMessage` Promise 被 reject，传播原始错误
- 已 yield 的 chunks 不受影响

### 场景 6: 用户未消费 finalMessage

- Promise 正常 resolve，只是没人 await
- 不影响流式消费和内存（chunks 数组在 generator 完成后可被 GC）

### 场景 7: 用户只 await finalMessage，不迭代 stream

- 由于采用 eager background consumer，source stream 会被后台完整消费
- `finalMessage` 在后台消费完成后正常 resolve
- 用户迭代器从共享 buffer 读取，不迭代也不影响 finalMessage
- 两种路径都能正常工作：
  - 路径 A：`for await` 迭代 + `await finalMessage` → 迭代过程中实时拿到 chunk，流结束后 finalMessage 立即 resolve
  - 路径 B：只 `await finalMessage` → 后台跑完全部 chunks 后 resolve

### 场景 8: 空流 (无任何 chunk)

- `mergeChunks([])` 返回一个最小有效 `ChatCompletion`
- 或抛出明确错误 `"Stream produced no chunks"`
- 建议：抛错，因为空流通常意味着上游异常

### 场景 9: 其他 stream API (非 completion)

- `imageGeneration`, `speech`, `transcription` 等也有 stream 模式
- 这些暂不加 `finalMessage`，只对 `completion` 加
- 后续按需扩展，类型系统保证类型安全

---

## 关键文件清单

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `packages/ada-pter/src/core/merge-chunks.ts` | 新增 | chunk 合并逻辑 |
| `packages/ada-pter/src/core/streaming-result.ts` | 新增 | StreamingResult 包装器 |
| `packages/ada-pter/src/core/adapter.ts` | 修改 | `executeAsStream` 改造 + 类型重载 |
| `packages/ada-pter/src/types/api/completion.ts` | 修改 | 新增 `StreamingCompletionResult` 类型 |

---

## 验证方案

1. **单元测试 `mergeChunks`**：
   - 正常文本流 → 完整 content 拼接
   - Tool call 流 → arguments 拼接、id/name 保留
   - 多 choice 流 → 按 index 分组
   - Thinking blocks → flatten 收集
   - 空流 → 抛错

2. **集成测试**：
   - `for await` + `await finalMessage` 组合使用
   - 只 `await finalMessage` 不迭代（验证后台消费）
   - 流中途错误时 `finalMessage` reject
   - `completion({ stream: false })` 不受影响

3. **类型检查**：
   - `StreamingCompletionResult` 可用于 `for await...of`
   - `finalMessage` 的类型是 `Promise<CompletionResponse>`
   - 非 stream 模式返回类型不变

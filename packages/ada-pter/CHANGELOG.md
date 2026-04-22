# ada-pter

## 0.6.0

### Minor Changes

- 4ade1b7: Add `finalMessage` property to streaming completions

  When calling `completion({ stream: true })`, the returned `StreamingCompletionResult` now includes a `finalMessage` Promise that resolves to the merged `ChatCompletion` after the stream ends. This allows users to access the complete message without manually collecting chunks.

  **New types:**

  - `StreamingCompletionResult` extends `AsyncIterable<CompletionChunk>` with a `readonly finalMessage: Promise<CompletionResponse>` property

  **New modules:**

  - `mergeChunks()` - Merges an array of `ChatCompletionChunk` into a single `ChatCompletion`
  - `createStreamingResult()` - Wraps a chunk stream into a `StreamingCompletionResult`

  **Usage:**

  ```typescript
  const stream = adapter.completion({ model: "gpt-4", messages: [...], stream: true });

  // Iterate chunks in real-time
  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
  }

  // Get the complete message after streaming
  const final = await stream.finalMessage;
  console.log(final.choices[0].message.content); // Full merged content
  ```

  The `finalMessage` resolves even if you don't iterate the stream (eager background consumer pattern).

## 0.5.1

### Patch Changes

- 07fa97a: Replace `deepMerge` with `mergeConfig`: top-level fields use shallow merge (later overrides earlier), while `extraBody` and `extraHeaders` internal fields are merged across config levels (one level deep, no recursion)

## 0.5.0

### Minor Changes

- 061a91b: Add `extraBody` and `extraHeaders` passthrough support for arbitrary request body fields and HTTP headers

## 0.4.0

### Minor Changes

- a6b465a: Add Anthropic model list to registry and auto-detection for claude-\* models

## 0.3.0

### Minor Changes

- dd7d366: Upgrade anthropic package with improvements; update type definitions in core and openai packages

## 0.2.0

### Minor Changes

- 98c7443: Update ada-pter package name to scoped style: @ada-pter/core

## 0.2.0

### Minor Changes

- 4a7353c: - Initial release of ada-pter: type-safe LLM adapter with Koa-style middleware, flexible routing/autoRoute, 4-level config, built-in retry + timeout, SSE streaming, multimodal APIs.
  - Publish official OpenAI provider ada-pter/openai, supporting chat completions (streaming), embeddings, audio TTS/STT, image generation, and responses APIs.
  - Add quick-start docs and examples for auto routing, fallback, and middleware usage.

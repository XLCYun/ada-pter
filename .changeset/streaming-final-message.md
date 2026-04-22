---
"@ada-pter/core": minor
---

Add `finalMessage` property to streaming completions

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

/// <reference path="../bun-test.d.ts" />
import { describe, expect, test } from "bun:test";
import { createStreamingResult } from "../../src/core/streaming-result";
import type { CompletionChunk, StreamingCompletionResult } from "../../src/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function chunk(overrides: Partial<CompletionChunk> = {}): CompletionChunk {
  return {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 1234567890,
    model: "test-model",
    choices: [],
    ...overrides,
  };
}

function makeStream<T>(chunks: T[], delay = 0): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        yield c;
      }
    },
  };
}

function makeErrorStream(err: Error, afterChunks = 0): AsyncIterable<CompletionChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < afterChunks; i++) {
        yield chunk({ choices: [{ index: 0, delta: { content: `chunk-${i}` }, finish_reason: null }] });
      }
      throw err;
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("createStreamingResult", () => {
  test("yields all chunks via iteration", async () => {
    const chunks = [
      chunk({ choices: [{ index: 0, delta: { content: "Hello" }, finish_reason: null }] }),
      chunk({ choices: [{ index: 0, delta: { content: " world" }, finish_reason: null }] }),
    ];

    const result = createStreamingResult(makeStream(chunks));
    const collected: CompletionChunk[] = [];
    for await (const c of result) {
      collected.push(c);
    }

    expect(collected).toHaveLength(2);
    expect(collected[0].choices[0].delta.content).toBe("Hello");
    expect(collected[1].choices[0].delta.content).toBe(" world");
  });

  test("finalMessage resolves to merged ChatCompletion", async () => {
    const chunks = [
      chunk({ choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] }),
      chunk({ choices: [{ index: 0, delta: { content: "Hi" }, finish_reason: null }] }),
      chunk({
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
      }),
    ];

    const result = createStreamingResult(makeStream(chunks));
    const final = await result.finalMessage;

    expect(final.object).toBe("chat.completion");
    expect(final.choices[0].message.content).toBe("Hi");
    expect(final.choices[0].finish_reason).toBe("stop");
    expect(final.usage?.total_tokens).toBe(6);
  });

  test("finalMessage resolves without iterating (background consumer)", async () => {
    const chunks = [
      chunk({ choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] }),
      chunk({ choices: [{ index: 0, delta: { content: "test" }, finish_reason: null }] }),
      chunk({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }),
    ];

    const result = createStreamingResult(makeStream(chunks));
    // Do NOT iterate — only await finalMessage
    const final = await result.finalMessage;

    expect(final.choices[0].message.content).toBe("test");
    expect(final.choices[0].finish_reason).toBe("stop");
  });

  test("iteration + finalMessage both work together", async () => {
    const chunks = [
      chunk({ choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] }),
      chunk({ choices: [{ index: 0, delta: { content: "A" }, finish_reason: null }] }),
      chunk({ choices: [{ index: 0, delta: { content: "B" }, finish_reason: null }] }),
      chunk({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }),
    ];

    const result = createStreamingResult(makeStream(chunks));
    const collected: CompletionChunk[] = [];
    for await (const c of result) {
      collected.push(c);
    }

    expect(collected).toHaveLength(4);

    const final = await result.finalMessage;
    expect(final.choices[0].message.content).toBe("AB");
  });

  test("finalMessage rejects on stream error", async () => {
    const result = createStreamingResult(makeErrorStream(new Error("stream broke"), 1));

    await expect(result.finalMessage).rejects.toThrow("stream broke");
  });

  test("iteration throws on stream error after yielding partial chunks", async () => {
    const result = createStreamingResult(makeErrorStream(new Error("mid-stream error"), 2));

    const collected: CompletionChunk[] = [];
    try {
      for await (const c of result) {
        collected.push(c);
      }
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe("mid-stream error");
    }
    expect(collected).toHaveLength(2);

    // Also verify finalMessage rejects with same error
    await expect(result.finalMessage).rejects.toThrow("mid-stream error");
  });

  test("finalMessage rejects on empty stream (mergeChunks throws)", async () => {
    const result = createStreamingResult(makeStream([]));
    await expect(result.finalMessage).rejects.toThrow("Stream produced no chunks");
  });

  test("returned object is a valid AsyncIterable", async () => {
    const chunks = [chunk({ choices: [{ index: 0, delta: { content: "x" }, finish_reason: null }] })];
    const result = createStreamingResult(makeStream(chunks));
    expect(typeof result[Symbol.asyncIterator]).toBe("function");
    // Consume to avoid unhandled rejection
    for await (const _ of result) { /* noop */ }
  });

  test("finalMessage is a non-writable property", async () => {
    const chunks = [chunk({ choices: [{ index: 0, delta: { content: "x" }, finish_reason: null }] })];
    const result = createStreamingResult(makeStream(chunks));
    const desc = Object.getOwnPropertyDescriptor(result, "finalMessage");
    expect(desc?.writable).toBe(false);
    expect(desc?.enumerable).toBe(true);
    expect(desc?.value).toBeInstanceOf(Promise);
    // Consume to avoid unhandled rejection
    await result.finalMessage;
  });

  test("scenario 6: not awaiting finalMessage has no side effects", async () => {
    const chunks = [
      chunk({ choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] }),
      chunk({ choices: [{ index: 0, delta: { content: "test" }, finish_reason: null }] }),
      chunk({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }),
    ];

    const result = createStreamingResult(makeStream(chunks));

    // Only iterate, never await finalMessage
    const collected: CompletionChunk[] = [];
    for await (const c of result) {
      collected.push(c);
    }

    // Iteration completes successfully
    expect(collected).toHaveLength(3);

    // No unhandled rejection — the finalMessage promise resolves silently
    // We can optionally await it to verify it resolved correctly
    const final = await result.finalMessage;
    expect(final.choices[0].message.content).toBe("test");
  });
});

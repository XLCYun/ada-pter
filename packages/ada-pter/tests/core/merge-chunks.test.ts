/// <reference path="../bun-test.d.ts" />
import { describe, expect, test } from "bun:test";
import { mergeChunks } from "../../src/core/merge-chunks";
import type { CompletionChunk, CompletionResponse } from "../../src/types";

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

function textDelta(content: string, role?: string): CompletionChunk {
  return chunk({
    choices: [
      {
        index: 0,
        delta: {
          ...(role && { role: role as "assistant" }),
          ...(content && { content }),
        },
        finish_reason: null,
      },
    ],
  });
}

function toolCallDelta(
  index: number,
  args: string,
  id?: string,
  name?: string,
): CompletionChunk {
  return chunk({
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              index,
              ...(id && { id }),
              type: "function",
              function: {
                ...(name && { name }),
                arguments: args,
              },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  });
}

function finishChunk(reason: string, usage?: CompletionResponse["usage"]): CompletionChunk {
  return chunk({
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: reason as CompletionChunk["choices"][number]["finish_reason"],
      },
    ],
    ...(usage && { usage }),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("mergeChunks", () => {
  test("throws on empty array", () => {
    expect(() => mergeChunks([])).toThrow("Stream produced no chunks");
  });

  test("merges normal text stream", () => {
    const chunks = [
      textDelta("", "assistant"),
      textDelta("Hello"),
      textDelta(" world"),
      finishChunk("stop", {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      }),
    ];

    const result = mergeChunks(chunks);

    expect(result.object).toBe("chat.completion");
    expect(result.id).toBe("chatcmpl-test");
    expect(result.model).toBe("test-model");
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0].message.role).toBe("assistant");
    expect(result.choices[0].message.content).toBe("Hello world");
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });

  test("merges tool calls stream", () => {
    const chunks = [
      textDelta("", "assistant"),
      toolCallDelta(0, "", "call_1", "get_weather"),
      toolCallDelta(0, '{"ci'),
      toolCallDelta(0, 'ty": "SF"}'),
      toolCallDelta(1, "", "call_2", "get_time"),
      toolCallDelta(1, '{"tz": "PST"}'),
      finishChunk("tool_calls"),
    ];

    const result = mergeChunks(chunks);

    expect(result.choices[0].finish_reason).toBe("tool_calls");
    expect(result.choices[0].message.tool_calls).toHaveLength(2);
    expect(result.choices[0].message.tool_calls![0]).toEqual({
      id: "call_1",
      type: "function",
      function: { name: "get_weather", arguments: '{"city": "SF"}' },
    });
    expect(result.choices[0].message.tool_calls![1]).toEqual({
      id: "call_2",
      type: "function",
      function: { name: "get_time", arguments: '{"tz": "PST"}' },
    });
  });

  test("merges multi-choice stream (n > 1)", () => {
    const chunks = [
      chunk({
        choices: [
          { index: 0, delta: { role: "assistant" }, finish_reason: null },
          { index: 1, delta: { role: "assistant" }, finish_reason: null },
        ],
      }),
      chunk({
        choices: [
          { index: 0, delta: { content: "Hello" }, finish_reason: null },
          { index: 1, delta: { content: "Hi" }, finish_reason: null },
        ],
      }),
      chunk({
        choices: [
          { index: 0, delta: { content: " there" }, finish_reason: null },
          { index: 1, delta: { content: " there" }, finish_reason: null },
        ],
      }),
      chunk({
        choices: [
          { index: 0, delta: {}, finish_reason: "stop" },
          { index: 1, delta: {}, finish_reason: "length" },
        ],
      }),
    ];

    const result = mergeChunks(chunks);

    expect(result.choices).toHaveLength(2);
    expect(result.choices[0].message.content).toBe("Hello there");
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.choices[1].message.content).toBe("Hi there");
    expect(result.choices[1].finish_reason).toBe("length");
  });

  test("merges thinking blocks by flattening", () => {
    const chunks = [
      chunk({
        choices: [
          {
            index: 0,
            delta: {
              role: "assistant",
              thinking_blocks: [{ type: "thinking", thinking: "Let me", signature: "sig1" }],
              reasoning_content: "Let me",
            },
            finish_reason: null,
          },
        ],
      }),
      chunk({
        choices: [
          {
            index: 0,
            delta: {
              thinking_blocks: [{ type: "thinking", thinking: " think", signature: "sig2" }],
              reasoning_content: " think",
            },
            finish_reason: null,
          },
        ],
      }),
      chunk({
        choices: [{ index: 0, delta: { content: "Answer" }, finish_reason: null }],
      }),
      finishChunk("stop"),
    ];

    const result = mergeChunks(chunks);

    expect(result.choices[0].message.thinking_blocks).toHaveLength(2);
    expect(result.choices[0].message.reasoning_content).toBe("Let me think");
    expect(result.choices[0].message.content).toBe("Answer");
  });

  test("takes last non-null usage", () => {
    const chunks = [
      chunk({
        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      }),
      textDelta("hi"),
      finishChunk("stop", {
        prompt_tokens: 10,
        completion_tokens: 1,
        total_tokens: 11,
      }),
    ];

    const result = mergeChunks(chunks);
    expect(result.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 1,
      total_tokens: 11,
    });
  });

  test("defaults finish_reason to 'stop' when null", () => {
    const chunks = [textDelta("hello")];
    const result = mergeChunks(chunks);
    expect(result.choices[0].finish_reason).toBe("stop");
  });

  test("preserves service_tier and system_fingerprint from first chunk", () => {
    const chunks = [
      chunk({
        service_tier: "auto",
        system_fingerprint: "fp-abc",
        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
      }),
      finishChunk("stop"),
    ];

    const result = mergeChunks(chunks);
    expect(result.service_tier).toBe("auto");
    expect(result.system_fingerprint).toBe("fp-abc");
  });

  test("handles function_call stream", () => {
    const chunks = [
      chunk({
        choices: [
          {
            index: 0,
            delta: { role: "assistant", function_call: { name: "get_weather", arguments: "" } },
            finish_reason: null,
          },
        ],
      }),
      chunk({
        choices: [
          {
            index: 0,
            delta: { function_call: { arguments: '{"city":'} },
            finish_reason: null,
          },
        ],
      }),
      chunk({
        choices: [
          {
            index: 0,
            delta: { function_call: { arguments: ' "SF"}' } },
            finish_reason: "function_call",
          },
        ],
      }),
    ];

    const result = mergeChunks(chunks);

    expect(result.choices[0].finish_reason).toBe("function_call");
    expect(result.choices[0].message.function_call).toEqual({
      name: "get_weather",
      arguments: '{"city": "SF"}',
    });
  });

  test("merges refusal field", () => {
    const chunks = [
      chunk({
        choices: [
          { index: 0, delta: { role: "assistant" }, finish_reason: null },
        ],
      }),
      chunk({
        choices: [
          { index: 0, delta: { refusal: "I cannot help with that." }, finish_reason: null },
        ],
      }),
      finishChunk("stop"),
    ];

    const result = mergeChunks(chunks);
    expect(result.choices[0].message.refusal).toBe("I cannot help with that.");
  });

  test("preserves logprobs from choices", () => {
    const logprobs = {
      content: [{ token: "Hello", logprob: -0.5, bytes: null, top_logprobs: [] }],
    };
    const chunks = [
      chunk({
        choices: [
          { index: 0, delta: { role: "assistant" }, finish_reason: null, logprobs: null },
        ],
      }),
      chunk({
        choices: [
          { index: 0, delta: { content: "Hi" }, finish_reason: null, logprobs: logprobs as any },
        ],
      }),
      finishChunk("stop"),
    ];

    const result = mergeChunks(chunks);
    expect(result.choices[0].logprobs).toEqual(logprobs);
  });
});

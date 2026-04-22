import { describe, expect, test } from "bun:test";
import type { AdapterContext } from "ada-pter";
import { anthropicStreamingTransformer } from "../src/response-stream";
import type { ChatCompletionChunk } from "ada-pter/types/openai";

// ---------------------------------------------------------------------------
// 工具函数：把 Anthropic 流事件序列转为 ChatCompletionChunk[]
// ---------------------------------------------------------------------------

async function collectChunks(events: object[]): Promise<ChatCompletionChunk[]> {
  async function* makeAsyncIterable() {
    for (const e of events) yield e;
  }

  const ctx = {
    apiType: "completion" as const,
    config: { stream: true },
    request: {} as AdapterContext["request"],
    response: { data: makeAsyncIterable(), raw: undefined },
    state: {},
  } as unknown as AdapterContext;

  await anthropicStreamingTransformer(ctx);

  const chunks: ChatCompletionChunk[] = [];
  for await (const chunk of ctx.response.data as AsyncIterable<ChatCompletionChunk>) {
    chunks.push(chunk);
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// 基础：非 AsyncIterable 时不处理
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — 非 AsyncIterable", () => {
  test("data 为 null 时直接返回，不修改 ctx.response.data", async () => {
    const ctx = {
      apiType: "completion" as const,
      config: { stream: true },
      request: {} as AdapterContext["request"],
      response: { data: null, raw: undefined },
      state: {},
    } as unknown as AdapterContext;
    await anthropicStreamingTransformer(ctx);
    expect(ctx.response.data).toBeNull();
  });

  test("data 为字符串时直接返回，不修改 ctx.response.data", async () => {
    const ctx = {
      apiType: "completion" as const,
      config: { stream: true },
      request: {} as AdapterContext["request"],
      response: { data: "not-a-stream", raw: undefined },
      state: {},
    } as unknown as AdapterContext;
    await anthropicStreamingTransformer(ctx);
    expect(ctx.response.data).toBe("not-a-stream");
  });
});

// ---------------------------------------------------------------------------
// message_start 事件
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — message_start", () => {
  test("message_start 生成包含 role=assistant 的首个 chunk", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-stream-1",
          model: "claude-3-5-sonnet-20241022",
          usage: {
            input_tokens: 10,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            server_tool_use: null,
          },
        },
      },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const first = chunks[0];
    expect(first.id).toBe("msg-stream-1");
    expect(first.object).toBe("chat.completion.chunk");
    expect(first.model).toBe("claude-3-5-sonnet-20241022");
    expect(first.choices[0].delta.role).toBe("assistant");
  });

  test("message_start 中的 usage 被映射到 chunk.usage", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-u",
          model: "claude-3-5-sonnet-20241022",
          usage: {
            input_tokens: 5,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            server_tool_use: null,
          },
        },
      },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const startChunk = chunks[0];
    expect(startChunk.usage?.prompt_tokens).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// content_block_start — text
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — text content", () => {
  test("content_block_start(text) 生成 content delta", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-t",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "Hello" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: " world" } },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const textChunks = chunks.filter((c) => c.choices[0].delta.content != null);
    const combined = textChunks.map((c) => c.choices[0].delta.content).join("");
    expect(combined).toBe("Hello world");
  });

  test("content_block_start(text) 中空 text 不生成 chunk", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-empty",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const textChunks = chunks.filter((c) => c.choices[0].delta.content != null);
    expect(textChunks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// content_block_start — tool_use
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — tool_use", () => {
  test("tool_use block 生成 tool_calls delta（含 id 和 name）", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-tc",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "call-1", name: "get_weather" },
      },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"city"' } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: ':"Paris"}' } },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const toolChunks = chunks.filter((c) => c.choices[0].delta.tool_calls != null);
    expect(toolChunks.length).toBeGreaterThan(0);

    // 第一个 tool chunk 应包含 id 和 name
    const firstToolChunk = toolChunks[0];
    const toolCall = firstToolChunk.choices[0].delta.tool_calls![0];
    expect(toolCall.id).toBe("call-1");
    expect(toolCall.function?.name).toBe("get_weather");

    // arguments 应被拼接
    const allArgs = toolChunks
      .flatMap((c) => c.choices[0].delta.tool_calls ?? [])
      .map((tc) => tc.function?.arguments ?? "")
      .join("");
    expect(allArgs).toContain("Paris");
  });

  test("tool_use block 无 input_json_delta 时 content_block_stop 生成 {} 作为 arguments", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-empty-tool",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "call-2", name: "noop" },
      },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const stopChunk = chunks.find(
      (c) => c.choices[0].delta.tool_calls?.[0]?.function?.arguments === "{}",
    );
    expect(stopChunk).toBeDefined();
  });

  test("多个 tool_use block 各自有独立的 index", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-multi-tool",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "call-a", name: "fn_a" } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "call-b", name: "fn_b" } },
      { type: "content_block_stop", index: 1 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const toolChunks = chunks.filter((c) => c.choices[0].delta.tool_calls != null);
    const indices = toolChunks.flatMap((c) => c.choices[0].delta.tool_calls!.map((tc) => tc.index));
    expect(indices).toContain(0);
    expect(indices).toContain(1);
  });
});

// ---------------------------------------------------------------------------
// content_block_start — server_tool_use
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — server_tool_use", () => {
  test("server_tool_use block 生成 tool_calls delta", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-srv",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "server_tool_use", id: "srvtoolu_1", name: "web_search" },
      },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const toolChunks = chunks.filter((c) => c.choices[0].delta.tool_calls != null);
    expect(toolChunks.length).toBeGreaterThan(0);
    expect(toolChunks[0].choices[0].delta.tool_calls![0].id).toBe("srvtoolu_1");
  });
});

// ---------------------------------------------------------------------------
// content_block_start — web_search_tool_result
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — web_search_tool_result", () => {
  test("web_search_tool_result block 生成 provider_specific_fields.web_search_results", async () => {
    const webResult = {
      type: "web_search_tool_result",
      tool_use_id: "srvtoolu_ws1",
      content: [{ type: "web_search_result", url: "https://example.com", title: "Example" }],
    };
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-ws",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: webResult },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const wsChunk = chunks.find(
      (c) => (c.choices[0].delta as { provider_specific_fields?: { web_search_results?: unknown[] } })
        .provider_specific_fields?.web_search_results != null,
    );
    expect(wsChunk).toBeDefined();
    const psf = (wsChunk!.choices[0].delta as { provider_specific_fields?: { web_search_results?: unknown[] } })
      .provider_specific_fields;
    expect(psf?.web_search_results).toHaveLength(1);
  });

  test("tool_search_tool_result block 不生成 chunk", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-ts",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "tool_search_tool_result",
          tool_use_id: "x",
          content: { type: "tool_search_tool_result_error", error_code: "unknown" },
        },
      },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunksBefore = (await collectChunks(events)).length;
    // tool_search_tool_result 被跳过，不额外产生 chunk
    const eventsWithout = events.filter((e) => e.type !== "content_block_start");
    const chunksWithout = (await collectChunks(eventsWithout)).length;
    expect(chunksBefore).toBe(chunksWithout);
  });

  test("code_execution_tool_result 被收集到 provider_specific_fields.tool_results", async () => {
    const codeResult = {
      type: "code_execution_tool_result",
      tool_use_id: "code_exec_1",
      content: [{ type: "text", text: "print('Hello')\nOutput: Hello" }],
    };
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-code",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: codeResult },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const codeChunk = chunks.find(
      (c) => (c.choices[0].delta as { provider_specific_fields?: { tool_results?: unknown[] } })
        .provider_specific_fields?.tool_results != null,
    );
    expect(codeChunk).toBeDefined();
    const psf = (codeChunk!.choices[0].delta as { provider_specific_fields?: { tool_results?: unknown[] } })
      .provider_specific_fields;
    expect(psf?.tool_results).toBeDefined();
    expect(psf?.tool_results?.[0]?.type).toBe("code_execution_tool_result");
  });

  test("bash_code_execution_tool_result 被收集到 provider_specific_fields.tool_results", async () => {
    const bashResult = {
      type: "bash_code_execution_tool_result",
      tool_use_id: "bash_exec_1",
      content: [{ type: "bash_execution_result_output", text: "file.txt\ndata.csv" }],
    };
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-bash",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: bashResult },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const bashChunk = chunks.find(
      (c) => (c.choices[0].delta as { provider_specific_fields?: { tool_results?: unknown[] } })
        .provider_specific_fields?.tool_results != null,
    );
    expect(bashChunk).toBeDefined();
    const psf = (bashChunk!.choices[0].delta as { provider_specific_fields?: { tool_results?: unknown[] } })
      .provider_specific_fields;
    expect(psf?.tool_results?.[0]?.type).toBe("bash_code_execution_tool_result");
  });

  test("text_editor_code_execution_tool_result 被收集到 provider_specific_fields.tool_results", async () => {
    const editorResult = {
      type: "text_editor_code_execution_tool_result",
      tool_use_id: "editor_exec_1",
      content: [{ type: "text_editor_view_content_result", content: "line 1\nline 2\nline 3" }],
    };
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-editor",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: editorResult },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const editorChunk = chunks.find(
      (c) => (c.choices[0].delta as { provider_specific_fields?: { tool_results?: unknown[] } })
        .provider_specific_fields?.tool_results != null,
    );
    expect(editorChunk).toBeDefined();
    const psf = (editorChunk!.choices[0].delta as { provider_specific_fields?: { tool_results?: unknown[] } })
      .provider_specific_fields;
    expect(psf?.tool_results?.[0]?.type).toBe("text_editor_code_execution_tool_result");
  });

  test("多个不同类型的 tool_result 被累积到 provider_specific_fields.tool_results", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-multi-tools",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "code_execution_tool_result",
          tool_use_id: "code_1",
          content: [{ type: "text", text: "Result 1" }],
        },
      },
      { type: "content_block_stop", index: 0 },
      {
        type: "content_block_start",
        index: 1,
        content_block: {
          type: "bash_code_execution_tool_result",
          tool_use_id: "bash_1",
          content: [{ type: "bash_execution_result_output", text: "Result 2" }],
        },
      },
      { type: "content_block_stop", index: 1 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const lastToolResultChunk = chunks
      .filter((c) => (c.choices[0].delta as { provider_specific_fields?: { tool_results?: unknown[] } })
        .provider_specific_fields?.tool_results != null)
      .pop();
    
    expect(lastToolResultChunk).toBeDefined();
    const psf = (lastToolResultChunk!.choices[0].delta as { provider_specific_fields?: { tool_results?: unknown[] } })
      .provider_specific_fields;
    // 最后的 chunk 应包含所有累积的 tool_results
    expect(psf?.tool_results?.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// content_block_delta — thinking_delta / signature_delta
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — thinking", () => {
  test("thinking_delta 生成 thinking_blocks delta 并累积 reasoning_content", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-think",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Step 1." } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: " Step 2." } },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const thinkChunks = chunks.filter(
      (c) => (c.choices[0].delta as { thinking_blocks?: unknown[] }).thinking_blocks != null,
    );
    expect(thinkChunks.length).toBeGreaterThan(0);
  });

  test("thinking_delta 的 reasoning_content 每个 chunk 只包含增量", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-reason",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Step 1." } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: " Step 2." } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: " Step 3." } },
      { type: "content_block_stop", index: 0 },
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: 10, input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
      },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);

    const reasoningChunks = chunks.filter((c) => c.choices[0].delta.reasoning_content != null);
    expect(reasoningChunks.length).toBe(3);

    // 每个 chunk 的 reasoning_content 是增量，不是累加值
    expect(reasoningChunks[0].choices[0].delta.reasoning_content).toBe("Step 1.");
    expect(reasoningChunks[1].choices[0].delta.reasoning_content).toBe(" Step 2.");
    expect(reasoningChunks[2].choices[0].delta.reasoning_content).toBe(" Step 3.");
  });

  test("signature_delta 生成 thinking_blocks delta（含 signature 字段）", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-sig",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Some thought." } },
      { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig_abc123" } },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const sigChunks = chunks.filter(
      (c) => {
        const tb = (c.choices[0].delta as { thinking_blocks?: Array<{ type: string; signature?: string }> }).thinking_blocks;
        return tb?.some((b) => b.type === "thinking" && b.signature);
      },
    );
    expect(sigChunks.length).toBeGreaterThan(0);
    const sigBlock = (sigChunks[0].choices[0].delta as { thinking_blocks?: Array<{ signature?: string }> }).thinking_blocks![0];
    expect(sigBlock.signature).toBe("sig_abc123");
  });

  test("signature_delta 时 reasoning_content 不增加（thinking 为空）", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-sig-reason",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig_xyz" } },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    // signature_delta 不累积 reasoning_content，所以 reasoning_content 应为 null
    const sigChunks = chunks.filter(
      (c) => {
        const tb = (c.choices[0].delta as { thinking_blocks?: Array<{ type: string; signature?: string }> }).thinking_blocks;
        return tb?.some((b) => b.type === "thinking" && b.signature);
      },
    );
    expect(sigChunks.length).toBeGreaterThan(0);
    expect(sigChunks[0].choices[0].delta.reasoning_content).toBeNull();
  });

  test("redacted_thinking block 生成 thinking_blocks delta（含 type=redacted_thinking）", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-redacted",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "redacted_thinking", data: "encrypted_data" },
      },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const redactedChunk = chunks.find(
      (c) => {
        const tb = (c.choices[0].delta as { thinking_blocks?: Array<{ type: string }> }).thinking_blocks;
        return tb?.some((b) => b.type === "redacted_thinking");
      },
    );
    expect(redactedChunk).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// content_block_delta — citations_delta
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — citations_delta", () => {
  test("citations_delta 生成 provider_specific_fields.citation", async () => {
    const citation = { type: "web_search_result_location", cited_text: "some text", url: "https://example.com" };
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-cite",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "citations_delta", citation } },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const citeChunk = chunks.find(
      (c) => (c.choices[0].delta as { provider_specific_fields?: { citation?: unknown } })
        .provider_specific_fields?.citation != null,
    );
    expect(citeChunk).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// message_delta — finish_reason
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — message_delta", () => {
  test("message_delta 生成带 finish_reason 的 chunk", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-delta",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: 15, input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
      },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const finishChunk = chunks.find((c) => c.choices[0].finish_reason != null);
    expect(finishChunk).toBeDefined();
    expect(finishChunk!.choices[0].finish_reason).toBe("stop");
  });

  test("message_delta stop_reason=tool_use 映射为 finish_reason=tool_calls", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-tool-finish",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      {
        type: "message_delta",
        delta: { stop_reason: "tool_use", stop_sequence: null },
        usage: { output_tokens: 5, input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
      },
      { type: "message_stop" },
    ];
    const chunks = await collectChunks(events);
    const finishChunk = chunks.find((c) => c.choices[0].finish_reason != null);
    expect(finishChunk!.choices[0].finish_reason).toBe("tool_calls");
  });
});

// ---------------------------------------------------------------------------
// error 事件
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — error 事件", () => {
  test("error 事件抛出包含 message 的错误", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-err",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "error", error: { type: "overloaded_error", message: "Service overloaded" } },
    ];

    await expect(collectChunks(events)).rejects.toThrow("Service overloaded");
  });
});

// ---------------------------------------------------------------------------
// 未知事件类型
// ---------------------------------------------------------------------------

describe("anthropicStreamingTransformer — 未知事件", () => {
  test("未知事件类型抛出错误", async () => {
    const events = [
      {
        type: "message_start",
        message: {
          id: "msg-unk",
          model: "claude-3-5-sonnet-20241022",
          usage: { input_tokens: 1, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, server_tool_use: null },
        },
      },
      { type: "unknown_future_event" },
    ];

    await expect(collectChunks(events)).rejects.toThrow("Unknown Anthropic event type");
  });
});

import { describe, expect, test } from "bun:test";
import type { AdapterContext } from "ada-pter";
import { getProvider } from "../src/completion";
import { extractResponseContent, transformParsedResponse } from "../src/response";
import { countReasoningTokens, mapFinishReason, mapUsage } from "../src/response-shared";
import type { Message } from "../src/types/messages";

const baseUsage = {
  input_tokens: 10,
  output_tokens: 20,
  cache_creation_input_tokens: null,
  cache_read_input_tokens: null,
  cache_creation: null,
  inference_geo: null,
  server_tool_use: null,
  service_tier: null,
} as Message["usage"];

describe("extractResponseContent", () => {
  test("extracts text only", () => {
    const message: Message = {
      id: "msg-1",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello", citations: null }],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: baseUsage,
      container: null,
    };
    const out = extractResponseContent(message);
    expect(out.textContent).toBe("Hello");
    expect(out.citations).toBeNull();
    expect(out.thinkingBlocks).toBeNull();
    expect(out.toolCalls).toEqual([]);
    expect(out.webSearchResults).toBeNull();
    expect(out.toolResults).toBeNull();
  });

  test("extracts citations as per-block grouped 2D array (LiteLLM-aligned)", () => {
    const message: Message = {
      id: "msg-cite",
      type: "message",
      role: "assistant",
      content: [
        { type: "text", text: "First block.", citations: [{ doc_id: "a", start_char_index: 0, end_char_index: 5 }] },
        { type: "text", text: "Second block.", citations: [{ doc_id: "b" }] },
      ],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: baseUsage,
      container: null,
    };
    const out = extractResponseContent(message);
    expect(out.citations).not.toBeNull();
    expect(out.citations).toHaveLength(2);
    expect(out.citations![0]).toEqual([
      { doc_id: "a", start_char_index: 0, end_char_index: 5, supported_text: "First block." },
    ]);
    expect(out.citations![1]).toEqual([{ doc_id: "b", supported_text: "Second block." }]);
  });

  test("extracts text and tool_use", () => {
    const message: Message = {
      id: "msg-2",
      type: "message",
      role: "assistant",
      content: [
        { type: "text", text: "Calling ", citations: null },
        {
          type: "tool_use",
          id: "tc-1",
          name: "get_weather",
          input: { location: "Paris" },
          caller: { type: "direct" },
        },
      ],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: baseUsage,
      container: null,
    };
    const out = extractResponseContent(message);
    expect(out.textContent).toBe("Calling ");
    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0]).toMatchObject({
      id: "tc-1",
      type: "function",
      function: { name: "get_weather", arguments: '{"location":"Paris"}' },
    });
  });

  test("extracts thinking blocks and reasoning content", () => {
    const message: Message = {
      id: "msg-3",
      type: "message",
      role: "assistant",
      content: [
        { type: "thinking", thinking: "Step 1.", signature: "x" },
        { type: "thinking", thinking: " Step 2.", signature: "y" },
        { type: "text", text: "Done.", citations: null },
      ],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: baseUsage,
      container: null,
    };
    const out = extractResponseContent(message);
    expect(out.textContent).toBe("Done.");
    expect(out.thinkingBlocks).toHaveLength(2);
    expect(out.reasoningContent).toBe("Step 1. Step 2.");
  });

  test("collects web_search_tool_result into webSearchResults", () => {
    const message: Message = {
      id: "msg-4",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "web_search_tool_result",
          tool_use_id: "srvtoolu-1",
          content: [],
          caller: { type: "direct" },
        },
      ],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: baseUsage,
      container: null,
    };
    const out = extractResponseContent(message);
    expect(out.webSearchResults).toHaveLength(1);
    expect((out.webSearchResults![0] as { type: string }).type).toBe("web_search_tool_result");
  });

  test("skips tool_search_tool_result", () => {
    const message: Message = {
      id: "msg-5",
      type: "message",
      role: "assistant",
      content: [
        {
          type: "tool_search_tool_result",
          tool_use_id: "x",
          content: { type: "tool_search_tool_result_error", error_code: "unknown" },
        },
      ],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: baseUsage,
      container: null,
    };
    const out = extractResponseContent(message);
    expect(out.webSearchResults).toBeNull();
    expect(out.toolResults).toBeNull();
  });
});

describe("mapFinishReason", () => {
  test("maps end_turn and stop_sequence to stop", () => {
    expect(mapFinishReason("end_turn")).toBe("stop");
    expect(mapFinishReason("stop_sequence")).toBe("stop");
  });
  test("maps max_tokens to length", () => {
    expect(mapFinishReason("max_tokens")).toBe("length");
  });
  test("maps tool_use to tool_calls", () => {
    expect(mapFinishReason("tool_use")).toBe("tool_calls");
  });
  test("maps pause_turn to stop (Anthropic-specific)", () => {
    expect(mapFinishReason("pause_turn")).toBe("stop");
  });
  test("maps refusal to content_filter (Anthropic-specific)", () => {
    expect(mapFinishReason("refusal")).toBe("content_filter");
  });
  test("maps null to stop", () => {
    expect(mapFinishReason(null)).toBe("stop");
  });
});

describe("mapUsage", () => {
  test("maps input/output tokens and adds total", () => {
    const usage = {
      ...baseUsage,
      input_tokens: 5,
      output_tokens: 15,
    };
    const out = mapUsage(usage, null);
    expect(out.prompt_tokens).toBe(5);
    expect(out.completion_tokens).toBe(15);
    expect(out.total_tokens).toBe(20);
  });
  test("includes cache tokens in prompt_tokens", () => {
    const usage = {
      ...baseUsage,
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 2,
      cache_read_input_tokens: 3,
    };
    const out = mapUsage(usage, null);
    expect(out.prompt_tokens).toBe(15);
    expect((out.prompt_tokens_details as Record<string, unknown>)?.cache_creation_tokens).toBe(2);
    expect((out.prompt_tokens_details as Record<string, unknown>)?.cached_tokens).toBe(3);
  });
  test("adds reasoning_tokens when reasoningContent provided (js-tiktoken)", () => {
    const out = mapUsage(baseUsage, "abcd");
    const details = out.completion_tokens_details as Record<string, unknown> | undefined;
    expect(details).toBeDefined();
    expect(details?.reasoning_tokens).toBe(countReasoningTokens("abcd"));
    expect(details?.text_tokens).toBe(20 - countReasoningTokens("abcd"));
  });

  test("always includes completion_tokens_details with text_tokens and reasoning_tokens", () => {
    const out = mapUsage(baseUsage, null);
    expect(out.completion_tokens_details).toBeDefined();
    const details = out.completion_tokens_details as Record<string, unknown>;
    expect(details.reasoning_tokens).toBe(0);
    expect(details.text_tokens).toBe(20);
  });

  test("includes server_tool_use when present in usage", () => {
    const usage = {
      ...baseUsage,
      server_tool_use: {
        web_search_requests: 2,
        web_fetch_requests: 0,
      } as Message["usage"]["server_tool_use"],
    };
    const out = mapUsage(usage, null);
    expect(out.server_tool_use).toEqual({ web_search_requests: 2 });
  });

  test("includes cache_creation_token_details when cache_creation present", () => {
    const usage = {
      ...baseUsage,
      cache_creation: {
        ephemeral_5m_input_tokens: 100,
        ephemeral_1h_input_tokens: 50,
      },
    } as Message["usage"];
    const out = mapUsage(usage, null);
    const details = out.prompt_tokens_details as Record<string, unknown> | undefined;
    expect(details?.cache_creation_token_details).toEqual({
      ephemeral_5m_input_tokens: 100,
      ephemeral_1h_input_tokens: 50,
    });
  });

  test("includes tool_search_requests when present in usage", () => {
    const usage = {
      ...baseUsage,
      server_tool_use: {
        web_search_requests: 1,
        web_fetch_requests: 0,
        tool_search_requests: 2,
      } as unknown as Message["usage"]["server_tool_use"],
    };
    const out = mapUsage(usage, null);
    expect(out.server_tool_use?.web_search_requests).toBe(1);
    expect(out.server_tool_use?.tool_search_requests).toBe(2);
  });
});

describe("transformParsedResponse", () => {
  test("produces valid ChatCompletion with text content", () => {
    const message: Message = {
      id: "msg-id",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hi there", citations: null }],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: baseUsage,
      container: null,
    };
    const out = transformParsedResponse(message);
    expect(out.id).toBe("msg-id");
    expect(out.object).toBe("chat.completion");
    expect(out.model).toBe("claude-3-5-sonnet-20241022");
    expect(out.choices).toHaveLength(1);
    expect(out.choices[0].index).toBe(0);
    expect(out.choices[0].finish_reason).toBe("stop");
    expect(out.choices[0].message.role).toBe("assistant");
    expect(out.choices[0].message.content).toBe("Hi there");
    expect(out.choices[0].message.tool_calls).toBeUndefined();
    expect(out.usage?.prompt_tokens).toBe(10);
    expect(out.usage?.completion_tokens).toBe(20);
    expect(out.usage?.total_tokens).toBe(30);
    const psf = (out.choices[0].message as { provider_specific_fields?: Record<string, unknown> })
      .provider_specific_fields;
    expect(psf).toBeDefined();
    expect(psf?.citations).toBeUndefined();
    expect(Array.isArray(psf?.thinking_blocks)).toBe(false);
  });

  test("includes tool_calls and provider_specific_fields when present", () => {
    const message: Message = {
      id: "msg-tc",
      type: "message",
      role: "assistant",
      content: [
        { type: "text", text: "Here you go.", citations: null },
        {
          type: "tool_use",
          id: "call_1",
          name: "run_query",
          input: { q: "test" },
          caller: { type: "direct" },
        },
      ],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: baseUsage,
      container: null,
    };
    const out = transformParsedResponse(message);
    expect(out.choices[0].finish_reason).toBe("tool_calls");
    expect(out.choices[0].message.tool_calls).toHaveLength(1);
    expect(out.choices[0].message.tool_calls![0].function.name).toBe("run_query");
    const psf = (out.choices[0].message as { provider_specific_fields?: Record<string, unknown> })
      .provider_specific_fields;
    expect(psf).toBeDefined();
    expect(psf?.citations).toBeUndefined();
  });

  test("throws on error response shape", () => {
    const errorBody = {
      error: { message: "Rate limited" },
    } as unknown as Message;
    expect(() => transformParsedResponse(errorBody)).toThrow("Rate limited");
  });
});

describe("anthropicResponseTransformer", () => {
  test("leaves ctx.response.data unchanged when data is null", async () => {
    const provider = getProvider();
    const handler = provider.getHandler({
      apiType: "completion",
      config: { stream: false },
    } as AdapterContext)!;
    const ctx = {
      apiType: "completion" as const,
      config: { stream: false },
      request: {},
      response: { data: undefined, raw: null },
      state: {},
    } as unknown as AdapterContext;
    await handler.responseTransformers[1](ctx);
    expect(ctx.response.data).toBeUndefined();
  });

  test("throws when response has error field", async () => {
    const provider = getProvider();
    const handler = provider.getHandler({
      apiType: "completion",
      config: { stream: false },
    } as AdapterContext)!;
    const ctx = {
      apiType: "completion" as const,
      config: { stream: false },
      request: {},
      response: {
        data: { error: { message: "Invalid API key" } },
        raw: null,
      },
      state: {},
    } as unknown as AdapterContext;
    await expect(handler.responseTransformers[1](ctx)).rejects.toThrow("Invalid API key");
  });

  test("transforms Message to ChatCompletion", async () => {
    const provider = getProvider();
    const handler = provider.getHandler({
      apiType: "completion",
      config: { stream: false },
    } as AdapterContext)!;
    const message: Message = {
      id: "gen-123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello world", citations: null }],
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: baseUsage,
      container: null,
    };
    const ctx = {
      apiType: "completion" as const,
      config: { stream: false },
      request: {},
      response: { data: message, raw: null },
      state: {},
    } as unknown as AdapterContext;
    await handler.responseTransformers[1](ctx);
    expect(ctx.response.data).toBeDefined();
    const completion = ctx.response.data as { id: string; choices: unknown[]; object: string };
    expect(completion.object).toBe("chat.completion");
    expect(completion.id).toBe("gen-123");
    expect(completion.choices).toHaveLength(1);
    expect((completion.choices[0] as { message: { content: string } }).message.content).toBe("Hello world");
  });
});

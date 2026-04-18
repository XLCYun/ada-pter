import { describe, expect, test } from "bun:test";
import type { ChatCompletionMessageFunctionToolCall } from "ada-pter/types/openai";
import { autoProvider, getProvider } from "../src";
import { createAdapter } from "ada-pter";
import type { AdapterContext, Middleware, Next, Provider } from "ada-pter";

const isDebug = Boolean(process.env.DEBUG);

const debugMiddleware: Middleware = async (ctx: AdapterContext, next: Next) => {
  if (isDebug) {
    const body = ctx.request.body;
    console.log("\n[DEBUG] ← REQUEST", ctx.request.url);
    console.log("[DEBUG]   BODY:", JSON.stringify(typeof body === "string" ? JSON.parse(body) : body, null, 2));
  }
  await next();
  if (isDebug) {
    const data = ctx.response.data;
    const isStream = data != null && typeof data === "object" && Symbol.asyncIterator in (data as object);
    if (isStream) {
      const original = data as AsyncIterable<unknown>;
      ctx.response.data = (async function* () {
        for await (const chunk of original) {
          console.log("[DEBUG] → CHUNK:", JSON.stringify(chunk));
          yield chunk;
        }
      })();
    } else {
      console.log("[DEBUG] → RESPONSE:", JSON.stringify(data, null, 2));
    }
  }
};

const createTestAdapter = (provider: Provider = autoProvider) =>
  createAdapter().use(debugMiddleware).route({ provider: "anthropic" }, provider);

const apiKey = process.env.ANTHROPIC_API_KEY;
const canRun = Boolean(apiKey);
const live = canRun ? describe : describe.skip;

const rawModel = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
const model = rawModel.includes("/") ? rawModel : `anthropic/${rawModel}`;

/** Narrow the union type to the function variant we use in assertions. */
const asFnToolCall = (tc: { type: string }): tc is ChatCompletionMessageFunctionToolCall => tc.type === "function";

live("live: @ada-pter/anthropic completion", () => {
  test("non-stream completion works with real Anthropic API", async () => {
    const a = createTestAdapter();

    const res = await a.completion({
      model,
      messages: [{ role: "user", content: "Reply with exactly one word: pong" }],
      max_tokens: 64,
      temperature: 1,
      timeout: 30_000,
    });

    expect(res.id).toBeString();
    expect(res.object).toBe("chat.completion");
    expect(Array.isArray(res.choices)).toBe(true);
    expect(res.choices.length).toBeGreaterThan(0);
    expect(res.choices[0].message.role).toBe("assistant");
    expect(res.choices[0].message.content).toBeString();
    expect(res.choices[0].message.content!.toLowerCase()).toContain("pong");
    expect(res.usage).toBeDefined();
    expect(res.usage!.prompt_tokens).toBeGreaterThan(0);
    expect(res.usage!.completion_tokens).toBeGreaterThan(0);
  });

  test("stream completion yields chunks with real Anthropic API", async () => {
    const a = createTestAdapter();

    const stream = a.completion({
      model,
      stream: true,
      messages: [{ role: "user", content: "Reply with exactly one word: pong" }],
      max_tokens: 64,
      temperature: 1,
      timeout: 30_000,
    });

    let chunkCount = 0;
    let hasContent = false;
    for await (const chunk of stream) {
      expect(chunk).toBeDefined();
      expect(chunk.object).toBe("chat.completion.chunk");
      if (chunk.choices?.[0]?.delta?.content) {
        hasContent = true;
      }
      chunkCount += 1;
    }

    expect(chunkCount).toBeGreaterThan(0);
    expect(hasContent).toBe(true);
  });

  test("completion with system message", async () => {
    const a = createTestAdapter();

    const res = await a.completion({
      model,
      messages: [
        {
          role: "system",
          content: "You are a helpful math tutor. Always reply with only the numeric answer, nothing else.",
        },
        { role: "user", content: "What is 2 + 3?" },
      ],
      max_tokens: 32,
      temperature: 0,
      timeout: 30_000,
    });

    expect(res.choices[0].message.content).toBeString();
    expect(res.choices[0].message.content!).toMatch(/5/);
  });
});

live("live: @ada-pter/anthropic multi-turn conversation", () => {
  test("multi-turn non-stream conversation", async () => {
    const a = createTestAdapter();

    // Turn 1
    const res1 = await a.completion({
      model,
      messages: [{ role: "user", content: "My favorite color is blue. Remember that." }],
      max_tokens: 64,
      temperature: 0,
      timeout: 30_000,
    });
    expect(res1.choices[0].message.content).toBeString();

    // Turn 2 — user asks about the previously mentioned color
    const res2 = await a.completion({
      model,
      messages: [
        { role: "user", content: "My favorite color is blue. Remember that." },
        { role: "assistant", content: res1.choices[0].message.content },
        { role: "user", content: "What is my favorite color? Reply with just the color name." },
      ],
      max_tokens: 32,
      temperature: 0,
      timeout: 30_000,
    });
    expect(res2.choices[0].message.content!.toLowerCase()).toContain("blue");
  });

  test("multi-turn stream conversation", async () => {
    const a = createTestAdapter();

    // Turn 1 — non-stream to capture assistant reply
    const res1 = await a.completion({
      model,
      messages: [{ role: "user", content: "I have 3 cats and 2 dogs. Remember that." }],
      max_tokens: 64,
      temperature: 0,
      timeout: 30_000,
    });
    expect(res1.choices[0].message.content).toBeString();

    // Turn 2 — stream, ask follow-up
    const stream = a.completion({
      model,
      stream: true,
      messages: [
        { role: "user", content: "I have 3 cats and 2 dogs. Remember that." },
        { role: "assistant", content: res1.choices[0].message.content },
        { role: "user", content: "How many pets do I have in total? Reply with just the number." },
      ],
      max_tokens: 32,
      temperature: 0,
      timeout: 30_000,
    });

    let collected = "";
    for await (const chunk of stream) {
      if (chunk.choices?.[0]?.delta?.content) {
        collected += chunk.choices[0].delta.content;
      }
    }
    expect(collected).toMatch(/5/);
  });

  test("multi-turn conversation with system + developer messages", async () => {
    const a = createTestAdapter();

    const res = await a.completion({
      model,
      messages: [
        { role: "system", content: "You always respond in English. Keep answers very brief." },
        { role: "developer", content: "Always end your response with '—done'." },
        { role: "user", content: "What is the capital of France?" },
      ],
      max_tokens: 64,
      temperature: 0,
      timeout: 30_000,
    });

    expect(res.choices[0].message.content!).toMatch(/paris/i);
  });

  test("multi-turn with 3+ exchanges", async () => {
    const a = createTestAdapter();

    const messages: Array<{ role: "user" | "assistant"; content: string | null }> = [];

    // Exchange 1
    messages.push({ role: "user", content: "Let's play a counting game. I say a number, you say the next. Ready? 1" });
    const res1 = await a.completion({
      model,
      messages: [...messages],
      max_tokens: 32,
      temperature: 0,
      timeout: 30_000,
    });
    const assistant1 = res1.choices[0].message.content ?? "";
    expect(assistant1).toMatch(/2/);
    messages.push({ role: "assistant", content: assistant1 });

    // Exchange 2
    messages.push({ role: "user", content: "3" });
    const res2 = await a.completion({
      model,
      messages: [...messages],
      max_tokens: 32,
      temperature: 0,
      timeout: 30_000,
    });
    const assistant2 = res2.choices[0].message.content ?? "";
    expect(assistant2).toMatch(/4/);
    messages.push({ role: "assistant", content: assistant2 });

    // Exchange 3
    messages.push({ role: "user", content: "5" });
    const res3 = await a.completion({
      model,
      messages: [...messages],
      max_tokens: 32,
      temperature: 0,
      timeout: 30_000,
    });
    expect(res3.choices[0].message.content!).toMatch(/6/);
  });
});

live("live: @ada-pter/anthropic thinking/reasoning", () => {
  test("non-stream completion with reasoning_effort (thinking)", async () => {
    const a = createTestAdapter(getProvider());

    const res = await a.completion({
      model,
      messages: [{ role: "user", content: "What is 17 * 23? Think step by step." }],
      max_tokens: 512,
      reasoning_effort: "low",
      temperature: 1,
      timeout: 60_000,
    });

    expect(res.id).toBeString();
    expect(res.choices).toBeDefined();
    expect(res.choices.length).toBeGreaterThan(0);
    expect(res.choices[0].message.role).toBe("assistant");
    expect(res.choices[0].message.content).toBeString();
    // Should contain the answer 391 somewhere
    expect(res.choices[0].message.content!).toMatch(/391/);
    // Thinking blocks should be present
    expect(res.choices[0].message.thinking_blocks).toBeDefined();
    expect(res.choices[0].message.thinking_blocks!.length).toBeGreaterThan(0);
    expect(res.choices[0].message.thinking_blocks![0].type).toBe("thinking");
    if (res.choices[0].message.thinking_blocks![0].type === "thinking") {
      expect(res.choices[0].message.thinking_blocks![0].thinking).toBeString();
      expect(res.choices[0].message.thinking_blocks![0].thinking.length).toBeGreaterThan(0);
    }
    // Reasoning content should be a non-empty string
    expect(res.choices[0].message.reasoning_content).toBeString();
    expect(res.choices[0].message.reasoning_content!.length).toBeGreaterThan(0);
  });

  test("stream completion with reasoning_effort (thinking)", async () => {
    const a = createTestAdapter(getProvider());

    const stream = a.completion({
      model,
      stream: true,
      messages: [{ role: "user", content: "What is 12 * 15? Think step by step." }],
      max_tokens: 512,
      reasoning_effort: "low",
      temperature: 1,
      timeout: 60_000,
    });

    let chunkCount = 0;
    let hasThinkingBlocks = false;
    let hasReasoningContent = false;
    let hasContent = false;
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      expect(chunk).toBeDefined();
      expect(chunk.object).toBe("chat.completion.chunk");
      chunkCount += 1;

      const delta = chunk.choices?.[0]?.delta;
      if (delta?.thinking_blocks && delta.thinking_blocks.length > 0) {
        hasThinkingBlocks = true;
      }
      if (delta?.reasoning_content) {
        hasReasoningContent = true;
      }
      if (delta?.content) {
        hasContent = true;
      }
      if (chunk.choices?.[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }
    }

    expect(chunkCount).toBeGreaterThan(0);
    expect(hasThinkingBlocks).toBe(true);
    expect(hasReasoningContent).toBe(true);
    expect(hasContent).toBe(true);
    expect(finishReason).toBe("stop");
  });

  test("non-stream with reasoning_effort medium", async () => {
    const a = createTestAdapter(getProvider());

    const res = await a.completion({
      model,
      messages: [{ role: "user", content: "Is 97 a prime number? Explain briefly." }],
      max_tokens: 256,
      reasoning_effort: "medium",
      temperature: 1,
      timeout: 60_000,
    });

    expect(res.choices[0].message.content).toBeString();
    expect(res.choices[0].message.thinking_blocks).toBeDefined();
    expect(res.choices[0].message.thinking_blocks!.length).toBeGreaterThan(0);
  });
});

live("live: @ada-pter/anthropic tool use", () => {
  const weatherTool = {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get the current weather for a given location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. San Francisco, CA",
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "The temperature unit to use",
          },
        },
        required: ["location"],
      },
    },
  };

  test("non-stream tool call request", async () => {
    const a = createTestAdapter();

    const res = await a.completion({
      model,
      messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
      tools: [weatherTool],
      tool_choice: "auto",
      max_tokens: 256,
      temperature: 0,
      timeout: 30_000,
    });

    expect(res.id).toBeString();
    expect(res.choices).toBeDefined();
    expect(res.choices.length).toBeGreaterThan(0);

    const message = res.choices[0].message;
    expect(message.tool_calls).toBeDefined();
    expect(message.tool_calls!.length).toBeGreaterThan(0);

    const toolCall = message.tool_calls![0];
    expect(toolCall.type).toBe("function");
    expect(asFnToolCall(toolCall)).toBe(true);
    expect(toolCall.function.name).toBe("get_weather");
    expect(toolCall.function.arguments).toBeString();

    const args = JSON.parse(toolCall.function.arguments);
    expect(args.location).toBeDefined();
    expect(typeof args.location).toBe("string");
  });

  test("stream tool call request", async () => {
    const a = createTestAdapter();

    const stream = a.completion({
      model,
      stream: true,
      messages: [{ role: "user", content: "What is the weather in Paris?" }],
      tools: [weatherTool],
      tool_choice: "auto",
      max_tokens: 256,
      temperature: 0,
      timeout: 30_000,
    });

    let chunkCount = 0;
    let toolCallArgs = "";
    let toolCallName = "";
    let toolCallId = "";
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      expect(chunk).toBeDefined();
      chunkCount += 1;

      const delta = chunk.choices?.[0]?.delta;
      if (delta?.tool_calls && delta.tool_calls.length > 0) {
        const tc = delta.tool_calls[0];
        if (tc.id) toolCallId = tc.id;
        if (tc.function?.name) toolCallName = tc.function.name;
        if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
      }
      if (chunk.choices?.[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }
    }

    expect(chunkCount).toBeGreaterThan(0);
    expect(toolCallId).toBeString();
    expect(toolCallId.length).toBeGreaterThan(0);
    expect(toolCallName).toBe("get_weather");
    expect(toolCallArgs).toBeString();

    const args = JSON.parse(toolCallArgs);
    expect(args.location).toBeDefined();
    expect(finishReason).toBe("tool_calls");
  });

  test("tool call roundtrip (call → result → final answer)", async () => {
    const a = createTestAdapter();

    // Step 1: Get tool call from assistant
    const firstRes = await a.completion({
      model,
      messages: [{ role: "user", content: "What is the weather in Berlin?" }],
      tools: [weatherTool],
      tool_choice: "auto",
      max_tokens: 256,
      temperature: 0,
      timeout: 30_000,
    });

    const toolCall = firstRes.choices[0].message.tool_calls![0];
    expect(toolCall).toBeDefined();
    expect(asFnToolCall(toolCall)).toBe(true);
    expect(toolCall.function.name).toBe("get_weather");

    // Step 2: Send tool result back and get final answer
    const secondRes = await a.completion({
      model,
      messages: [
        { role: "user", content: "What is the weather in Berlin?" },
        {
          role: "assistant",
          content: firstRes.choices[0].message.content,
          tool_calls: [toolCall],
        },
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ temperature: "22°C", condition: "Sunny", location: "Berlin" }),
        },
      ],
      tools: [weatherTool],
      max_tokens: 256,
      temperature: 0,
      timeout: 30_000,
    });

    expect(secondRes.choices[0].message.content).toBeString();
    expect(secondRes.choices[0].message.content!.toLowerCase()).toMatch(/22|sunny|berlin/);
  });

  test("tool_choice required forces tool call", async () => {
    const a = createTestAdapter();

    const res = await a.completion({
      model,
      messages: [{ role: "user", content: "What is the weather in San Francisco, CA?" }],
      tools: [weatherTool],
      tool_choice: "required",
      max_tokens: 256,
      temperature: 0,
      timeout: 30_000,
    });

    expect(res.choices[0].message.tool_calls).toBeDefined();
    expect(res.choices[0].message.tool_calls!.length).toBeGreaterThan(0);
    const tc = res.choices[0].message.tool_calls![0];
    expect(asFnToolCall(tc)).toBe(true);
    expect(tc.function.name).toBe("get_weather");
  });

  //  使用 claude-sonnet-4-6 测试
  test("tool_choice none suppresses tool call", async () => {
    const a = createTestAdapter();

    const res = await a.completion({
      model,
      messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
      tools: [weatherTool],
      tool_choice: "none",
      max_tokens: 256,
      temperature: 0,
      timeout: 30_000,
    });

    expect(res.choices[0].message.content).toBeString();
    // tool_calls should not be present or should be empty when tool_choice is "none"
    expect(res.choices[0].message.tool_calls).toBeUndefined();
  });
});

live("live: @ada-pter/anthropic thinking + tool use", () => {
  const calculatorTool = {
    type: "function" as const,
    function: {
      name: "calculate",
      description: "Perform a mathematical calculation",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "The mathematical expression to evaluate, e.g. '2 + 2'",
          },
        },
        required: ["expression"],
      },
    },
  };

  test("non-stream with thinking and tool call", async () => {
    const a = createTestAdapter(getProvider());

    const res = await a.completion({
      model,
      messages: [{ role: "user", content: "What is (23 * 7) + (15 * 3)? Use the calculator." }],
      tools: [calculatorTool],
      tool_choice: "auto",
      max_tokens: 512,
      reasoning_effort: "low",
      temperature: 1,
      timeout: 60_000,
    });

    expect(res.id).toBeString();
    expect(res.choices).toBeDefined();
    expect(res.choices.length).toBeGreaterThan(0);

    const message = res.choices[0].message;
    // Should have thinking blocks
    expect(message.thinking_blocks).toBeDefined();
    expect(message.thinking_blocks!.length).toBeGreaterThan(0);
    expect(message.thinking_blocks![0].type).toBe("thinking");
    // Should have a tool call
    expect(message.tool_calls).toBeDefined();
    expect(message.tool_calls!.length).toBeGreaterThan(0);
    const tc = message.tool_calls![0];
    expect(asFnToolCall(tc)).toBe(true);
    expect(tc.function.name).toBe("calculate");
  });

  test("stream with thinking and tool call", async () => {
    const a = createTestAdapter(getProvider());

    const stream = a.completion({
      model,
      stream: true,
      messages: [{ role: "user", content: "Calculate sqrt(144) using the calculator." }],
      tools: [calculatorTool],
      tool_choice: "auto",
      max_tokens: 512,
      reasoning_effort: "low",
      temperature: 1,
      timeout: 60_000,
    });

    let chunkCount = 0;
    let hasThinkingBlocks = false;
    let toolCallArgs = "";
    let toolCallName = "";
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      expect(chunk).toBeDefined();
      chunkCount += 1;

      const delta = chunk.choices?.[0]?.delta;
      if (delta?.thinking_blocks && delta.thinking_blocks.length > 0) {
        hasThinkingBlocks = true;
      }
      if (delta?.tool_calls && delta.tool_calls.length > 0) {
        const tc = delta.tool_calls[0];
        if (tc.function?.name) toolCallName = tc.function.name;
        if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
      }
      if (chunk.choices?.[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }
    }

    expect(chunkCount).toBeGreaterThan(0);
    expect(hasThinkingBlocks).toBe(true);
    expect(toolCallName).toBe("calculate");
    expect(toolCallArgs).toBeString();
    expect(finishReason).toBe("tool_calls");
  });

  test("thinking + tool call roundtrip", async () => {
    const a = createTestAdapter(getProvider());

    // Step 1: Get tool call with thinking
    const firstRes = await a.completion({
      model,
      messages: [{ role: "user", content: "What is 8^3? Use the calculator." }],
      tools: [calculatorTool],
      tool_choice: "auto",
      max_tokens: 512,
      reasoning_effort: "low",
      temperature: 1,
      timeout: 60_000,
    });

    const message = firstRes.choices[0].message;
    expect(message.thinking_blocks).toBeDefined();
    expect(message.thinking_blocks!.length).toBeGreaterThan(0);
    expect(message.tool_calls).toBeDefined();
    expect(message.tool_calls!.length).toBeGreaterThan(0);

    const toolCall = message.tool_calls![0];

    // Step 2: Send tool result back and get final answer with thinking
    const secondRes = await a.completion({
      model,
      messages: [
        { role: "user", content: "What is 8^3? Use the calculator." },
        {
          role: "assistant",
          content: message.content,
          tool_calls: [toolCall],
          thinking_blocks: message.thinking_blocks,
        },
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ result: 512 }),
        },
      ],
      tools: [calculatorTool],
      max_tokens: 512,
      reasoning_effort: "low",
      temperature: 1,
      timeout: 60_000,
    });

    expect(secondRes.choices[0].message.content).toBeString();
    expect(secondRes.choices[0].message.content!).toMatch(/512/);
  });
});

live("live: @ada-pter/anthropic multi-tool use", () => {
  const tools = [
    {
      type: "function" as const,
      function: {
        name: "get_weather",
        description: "Get the current weather for a given location",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name" },
          },
          required: ["location"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_time",
        description: "Get the current time for a given timezone",
        parameters: {
          type: "object",
          properties: {
            timezone: { type: "string", description: "IANA timezone, e.g. America/New_York" },
          },
          required: ["timezone"],
        },
      },
    },
  ];

  test("parallel tool calls in non-stream", async () => {
    const a = createTestAdapter();

    const res = await a.completion({
      model,
      messages: [{ role: "user", content: "What is the weather and current time in New York?" }],
      tools,
      tool_choice: "auto",
      max_tokens: 512,
      temperature: 0,
      timeout: 30_000,
    });

    expect(res.choices[0].message.tool_calls).toBeDefined();
    const toolCalls = res.choices[0].message.tool_calls!;
    // Should have at least 2 tool calls (weather + time)
    expect(toolCalls.length).toBeGreaterThanOrEqual(2);
    const names = toolCalls
      .filter(asFnToolCall)
      .map((tc) => tc.function.name)
      .sort();
    expect(names).toContain("get_weather");
    expect(names).toContain("get_time");
  });

  test("parallel tool calls in stream", async () => {
    const a = createTestAdapter();

    const stream = a.completion({
      model,
      stream: true,
      messages: [{ role: "user", content: "What is the weather and current time in London?" }],
      tools,
      tool_choice: "auto",
      max_tokens: 512,
      temperature: 0,
      timeout: 30_000,
    });

    const toolCallArgsMap = new Map<number, { name: string; args: string; id: string }>();

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCallArgsMap.get(tc.index) ?? { name: "", args: "", id: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
          toolCallArgsMap.set(tc.index, existing);
        }
      }
    }

    expect(toolCallArgsMap.size).toBeGreaterThanOrEqual(2);
    const names = Array.from(toolCallArgsMap.values())
      .map((v) => v.name)
      .sort();
    expect(names).toContain("get_weather");
    expect(names).toContain("get_time");
  });
});

if (!canRun) {
  const reasons: string[] = [];
  if (!apiKey) reasons.push("ANTHROPIC_API_KEY");
  console.info(`[live-test skipped] Missing: ${reasons.join(", ")}`);
}

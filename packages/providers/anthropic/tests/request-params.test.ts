import { describe, expect, test } from "bun:test";
import type { AdapterContext } from "ada-pter";
import { buildBody } from "../src/request-params";
import { resolveThinkingOptions } from "../src/thinking";

const defaultOptions = resolveThinkingOptions();

const makeCtx = (config: Record<string, unknown>): AdapterContext => {
  const model = (config.model as string) ?? "claude-3-5-sonnet-20241022";
  return {
    apiType: "completion",
    model,
    modelId: model,
    providerKey: "anthropic",
    normModel: model.toLowerCase(),
    normProvider: "anthropic",
    normModelId: `anthropic/${model.toLowerCase()}`,
    config: { messages: [], model, ...config },
    request: {} as AdapterContext["request"],
    response: {},
    state: {},
  } as unknown as AdapterContext;
};

// ---------------------------------------------------------------------------
// buildBody — 基础字段映射
// ---------------------------------------------------------------------------

describe("buildBody — 基础字段", () => {
  test("model 从 ctx.model 取得", () => {
    const ctx = makeCtx({ model: "claude-3-opus-20240229", messages: [] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.model).toBe("claude-3-opus-20240229");
  });

  test("max_tokens 默认为 4096", () => {
    const ctx = makeCtx({ messages: [] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.max_tokens).toBe(4096);
  });

  test("max_completion_tokens 优先于 max_tokens", () => {
    const ctx = makeCtx({ messages: [], max_completion_tokens: 1000, max_tokens: 500 });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.max_tokens).toBe(1000);
  });

  test("max_tokens 在 max_completion_tokens 缺失时生效", () => {
    const ctx = makeCtx({ messages: [], max_tokens: 2048 });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.max_tokens).toBe(2048);
  });

  test("temperature 被透传", () => {
    const ctx = makeCtx({ messages: [], temperature: 0.7 });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.temperature).toBe(0.7);
  });

  test("top_p 被透传", () => {
    const ctx = makeCtx({ messages: [], top_p: 0.9 });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.top_p).toBe(0.9);
  });

  test("stream 默认为 false", () => {
    const ctx = makeCtx({ messages: [] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.stream).toBe(false);
  });

  test("stream=true 被透传", () => {
    const ctx = makeCtx({ messages: [], stream: true });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.stream).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildBody — stop_sequences 映射
// ---------------------------------------------------------------------------

describe("buildBody — stop_sequences", () => {
  test("stop 为字符串时转为单元素数组", () => {
    const ctx = makeCtx({ messages: [], stop: "STOP" });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.stop_sequences).toEqual(["STOP"]);
  });

  test("stop 为数组时直接使用", () => {
    const ctx = makeCtx({ messages: [], stop: ["END", "DONE"] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.stop_sequences).toEqual(["END", "DONE"]);
  });

  test("stop 缺失时 stop_sequences 为 undefined", () => {
    const ctx = makeCtx({ messages: [] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.stop_sequences).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildBody — system 消息抽离
// ---------------------------------------------------------------------------

describe("buildBody — system 消息", () => {
  test("system 消息被抽离为 body.system", () => {
    const ctx = makeCtx({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi" },
      ],
    });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.system).toBeDefined();
    expect(Array.isArray(body.system)).toBe(true);
    expect((body.system as Array<{ type: string; text: string }>)[0].text).toBe("You are helpful.");
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
  });

  test("无 system 消息时 body.system 为 undefined", () => {
    const ctx = makeCtx({ messages: [{ role: "user", content: "Hi" }] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.system).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildBody — tool_choice 映射
// ---------------------------------------------------------------------------

describe("buildBody — tool_choice", () => {
  test("tool_choice=auto 映射为 { type: 'auto' }", () => {
    const ctx = makeCtx({ messages: [], tool_choice: "auto" });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.tool_choice).toEqual({ type: "auto" });
  });

  test("tool_choice=required 映射为 { type: 'any' }", () => {
    const ctx = makeCtx({ messages: [], tool_choice: "required" });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.tool_choice).toEqual({ type: "any" });
  });

  test("tool_choice=none 映射为 { type: 'none' }", () => {
    const ctx = makeCtx({ messages: [], tool_choice: "none" });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.tool_choice).toEqual({ type: "none" });
  });

  test("tool_choice={type:'function',function:{name:'fn'}} 映射为 { type: 'tool', name: 'fn' }", () => {
    const ctx = makeCtx({
      messages: [],
      tool_choice: { type: "function", function: { name: "my_fn" } },
    });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.tool_choice).toEqual({ type: "tool", name: "my_fn" });
  });

  test("parallel_tool_calls=false 时追加 disable_parallel_tool_use: true", () => {
    const ctx = makeCtx({ messages: [], tool_choice: "auto", parallel_tool_calls: false });
    const { body } = buildBody(ctx, defaultOptions);
    expect((body.tool_choice as unknown as Record<string, unknown>)?.disable_parallel_tool_use).toBe(true);
  });

  test("parallel_tool_calls=true 时追加 disable_parallel_tool_use: false", () => {
    const ctx = makeCtx({ messages: [], tool_choice: "auto", parallel_tool_calls: true });
    const { body } = buildBody(ctx, defaultOptions);
    expect((body.tool_choice as unknown as Record<string, unknown>)?.disable_parallel_tool_use).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildBody — service_tier 映射
// ---------------------------------------------------------------------------

describe("buildBody — service_tier", () => {
  test("service_tier=default 映射为 standard_only", () => {
    const ctx = makeCtx({ messages: [], service_tier: "default" });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.service_tier).toBe("standard_only");
  });

  test("service_tier=flex 映射为 standard_only", () => {
    const ctx = makeCtx({ messages: [], service_tier: "flex" });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.service_tier).toBe("standard_only");
  });

  test("service_tier=auto 映射为 auto", () => {
    const ctx = makeCtx({ messages: [], service_tier: "auto" });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.service_tier).toBe("auto");
  });

  test("service_tier=scale 映射为 auto", () => {
    const ctx = makeCtx({ messages: [], service_tier: "scale" });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.service_tier).toBe("auto");
  });

  test("service_tier=priority 映射为 auto", () => {
    const ctx = makeCtx({ messages: [], service_tier: "priority" });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.service_tier).toBe("auto");
  });

  test("service_tier 缺失时为 undefined", () => {
    const ctx = makeCtx({ messages: [] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.service_tier).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildBody — tools 映射
// ---------------------------------------------------------------------------

describe("buildBody — tools", () => {
  test("无 tools 时 body.tools 为 undefined", () => {
    const ctx = makeCtx({ messages: [] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.tools).toBeUndefined();
  });

  test("function 工具被映射为 Anthropic Tool", () => {
    const ctx = makeCtx({
      messages: [],
      tools: [
        {
          type: "function",
          function: {
            name: "search",
            description: "Search the web",
            parameters: { type: "object", properties: { q: { type: "string" } } },
          },
        },
      ],
    });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.tools).toHaveLength(1);
    expect((body.tools![0] as { name: string }).name).toBe("search");
  });

  test("消息中有 tool_calls 但 tools 未提供时自动注入 dummy tool", () => {
    const ctx = makeCtx({
      messages: [
        {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "call-1", type: "function", function: { name: "fn", arguments: "{}" } }],
        },
        { role: "tool", tool_call_id: "call-1", content: "result" },
      ],
    });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.tools).toBeDefined();
    expect(body.tools!.some((t) => (t as { name: string }).name === "__dummy_tool__")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildBody — web_search_options
// ---------------------------------------------------------------------------

describe("buildBody — web_search_options", () => {
  test("web_search_options 存在时追加 web_search_20250305 工具", () => {
    const ctx = makeCtx({
      messages: [],
      web_search_options: { search_context_size: "medium" },
    });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.tools).toBeDefined();
    expect(body.tools!.some((t) => (t as { type: string }).type === "web_search_20250305")).toBe(true);
  });

  test("web_search_options 存在时 anthropicBetaValues 包含 web-search-2025-03-05", () => {
    const ctx = makeCtx({
      messages: [],
      web_search_options: {},
    });
    const { anthropicBetaValues } = buildBody(ctx, defaultOptions);
    expect(anthropicBetaValues).toContain("web-search-2025-03-05");
  });
});

// ---------------------------------------------------------------------------
// buildBody — response_format → output_config
// ---------------------------------------------------------------------------

describe("buildBody — response_format", () => {
  test("response_format=json_object 映射为 output_config.format.type='json_schema'", () => {
    const ctx = makeCtx({ messages: [], response_format: { type: "json_object" } });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.output_config?.format?.type).toBe("json_schema");
    expect((body.output_config?.format as { schema?: unknown })?.schema).toEqual({ type: "object" });
  });

  test("response_format=json_schema 映射为 output_config.format（使用提供的 schema）", () => {
    const schema = { type: "object", properties: { name: { type: "string" } } };
    const ctx = makeCtx({
      messages: [],
      response_format: { type: "json_schema", json_schema: { name: "MySchema", schema } },
    });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.output_config?.format?.type).toBe("json_schema");
    expect((body.output_config?.format as { schema?: unknown })?.schema).toEqual(schema);
  });

  test("response_format=text 时 output_config.format 为 undefined", () => {
    const ctx = makeCtx({ messages: [], response_format: { type: "text" } });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.output_config?.format).toBeUndefined();
  });

  test("response_format 存在时 anthropicBetaValues 包含 structured-outputs-2025-11-13", () => {
    const ctx = makeCtx({ messages: [], response_format: { type: "json_object" } });
    const { anthropicBetaValues } = buildBody(ctx, defaultOptions);
    expect(anthropicBetaValues).toContain("structured-outputs-2025-11-13");
  });
});

// ---------------------------------------------------------------------------
// buildBody — thinking / reasoning_effort
// ---------------------------------------------------------------------------

describe("buildBody — thinking", () => {
  test("reasoning_effort=medium 在非 opus 模型上生成 thinking.type=enabled", () => {
    const ctx = makeCtx({
      model: "claude-3-5-sonnet-20241022",
      messages: [],
      reasoning_effort: "medium",
    });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.thinking?.type).toBe("enabled");
    expect((body.thinking as { budget_tokens?: number })?.budget_tokens).toBe(2048);
  });

  test("reasoning_effort=none 时 thinking 为 undefined", () => {
    const ctx = makeCtx({ messages: [], reasoning_effort: "none" });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.thinking).toBeUndefined();
  });

  test("opus-4-6 模型上 reasoning_effort 生成 thinking.type=adaptive", () => {
    const ctx = makeCtx({
      model: "claude-opus-4-6-20250514",
      messages: [],
      reasoning_effort: "high",
    });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.thinking?.type).toBe("adaptive");
  });

  test("有 tool_calls 但无 thinking_blocks 的 assistant 消息时 thinking 被丢弃", () => {
    const ctx = makeCtx({
      model: "claude-3-5-sonnet-20241022",
      messages: [
        {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "c1", type: "function", function: { name: "fn", arguments: "{}" } }],
        },
        { role: "tool", tool_call_id: "c1", content: "result" },
      ],
      reasoning_effort: "high",
    });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.thinking).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildBody — metadata
// ---------------------------------------------------------------------------

describe("buildBody — metadata", () => {
  test("metadata.user_id 被透传", () => {
    const ctx = makeCtx({ messages: [], metadata: { user_id: "user-123" } });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.metadata?.user_id).toBe("user-123");
  });

  test("metadata 缺失时 body.metadata 为 undefined", () => {
    const ctx = makeCtx({ messages: [] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.metadata).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildBody — top_k
// ---------------------------------------------------------------------------

describe("buildBody — top_k", () => {
  test("top_k 被透传", () => {
    const ctx = makeCtx({ messages: [], top_k: 40 });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.top_k).toBe(40);
  });

  test("top_k 缺失时为 undefined", () => {
    const ctx = makeCtx({ messages: [] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.top_k).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildBody — cache_control
// ---------------------------------------------------------------------------

describe("buildBody — cache_control", () => {
  test("cache_control 被透传", () => {
    const ctx = makeCtx({ messages: [], cache_control: { type: "ephemeral" } });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.cache_control).toEqual({ type: "ephemeral" });
  });

  test("cache_control 缺失时为 undefined", () => {
    const ctx = makeCtx({ messages: [] });
    const { body } = buildBody(ctx, defaultOptions);
    expect(body.cache_control).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildBody — effort header（Anthropic Beta）
// ---------------------------------------------------------------------------

describe("buildBody — effort header", () => {
  test("opus-4-5 模型上 reasoning_effort 时 anthropicBetaValues 包含 effort-2025-11-24", () => {
    const ctx = makeCtx({
      model: "claude-opus-4-5-20250514",
      messages: [],
      reasoning_effort: "high",
    });
    const { anthropicBetaValues } = buildBody(ctx, defaultOptions);
    expect(anthropicBetaValues).toContain("effort-2025-11-24");
  });

  test("opus-4-6 模型上 reasoning_effort 时 anthropicBetaValues 包含 effort-2025-11-24", () => {
    const ctx = makeCtx({
      model: "claude-opus-4-6-20250514",
      messages: [],
      reasoning_effort: "medium",
    });
    const { anthropicBetaValues } = buildBody(ctx, defaultOptions);
    expect(anthropicBetaValues).toContain("effort-2025-11-24");
  });

  test("非 opus 模型上 reasoning_effort 时 anthropicBetaValues 不包含 effort-2025-11-24", () => {
    const ctx = makeCtx({
      model: "claude-3-5-sonnet-20241022",
      messages: [],
      reasoning_effort: "high",
    });
    const { anthropicBetaValues } = buildBody(ctx, defaultOptions);
    expect(anthropicBetaValues).not.toContain("effort-2025-11-24");
  });

  test("reasoning_effort=none 时 anthropicBetaValues 不包含 effort-2025-11-24", () => {
    const ctx = makeCtx({
      model: "claude-opus-4-5-20250514",
      messages: [],
      reasoning_effort: "none",
    });
    const { anthropicBetaValues } = buildBody(ctx, defaultOptions);
    expect(anthropicBetaValues).not.toContain("effort-2025-11-24");
  });
});

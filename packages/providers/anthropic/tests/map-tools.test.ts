import { describe, expect, test } from "bun:test";
import { mapTools, mergeToolProviderFields } from "../src/map-tools";
import type { OpenAICompletionConfig } from "../src/request-params";

type OpenAITools = OpenAICompletionConfig["tools"];

// ---------------------------------------------------------------------------
// mapTools
// ---------------------------------------------------------------------------

describe("mapTools", () => {
  test("undefined 时原样返回 undefined", () => {
    expect(mapTools(undefined)).toBeUndefined();
  });

  test("非数组值原样返回", () => {
    // @ts-expect-error 测试非数组输入
    expect(mapTools("auto")).toBe("auto");
  });

  test("空数组返回空数组", () => {
    expect(mapTools([])).toEqual([]);
  });

  test("function 类型工具被映射为 Anthropic Tool（含 input_schema）", () => {
    const tools: OpenAITools = [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get the weather",
          parameters: {
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
          },
        },
      },
    ];
    const result = mapTools(tools)!;
    expect(result).toHaveLength(1);
    const tool = result[0] as { name: string; description?: string; input_schema: Record<string, unknown> };
    expect(tool.name).toBe("get_weather");
    expect(tool.description).toBe("Get the weather");
    expect(tool.input_schema.type).toBe("object");
    expect((tool.input_schema.properties as Record<string, unknown>).city).toBeDefined();
    expect(tool.input_schema.required).toEqual(["city"]);
  });

  test("function 工具的 parameters 缺失时 input_schema 默认为 { type: 'object' }", () => {
    const tools: OpenAITools = [
      {
        type: "function",
        function: { name: "noop" },
      },
    ];
    const result = mapTools(tools)!;
    const tool = result[0] as { input_schema: Record<string, unknown> };
    expect(tool.input_schema.type).toBe("object");
  });

  test("input_schema 中多余字段（如 additionalProperties）被过滤掉", () => {
    const tools: OpenAITools = [
      {
        type: "function",
        function: {
          name: "fn",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
            $schema: "http://json-schema.org/draft-07/schema#",
          },
        },
      },
    ];
    const result = mapTools(tools)!;
    const tool = result[0] as { input_schema: Record<string, unknown> };
    expect(Object.keys(tool.input_schema)).not.toContain("additionalProperties");
    expect(Object.keys(tool.input_schema)).not.toContain("$schema");
    expect(tool.input_schema.type).toBe("object");
  });

  test("custom 类型工具被映射为 Anthropic Tool（input_schema 为空 object）", () => {
    const tools: OpenAITools = [
      {
        type: "custom",
        custom: {
          name: "my_custom_tool",
          description: "A custom tool",
        },
      },
    ];
    const result = mapTools(tools)!;
    expect(result).toHaveLength(1);
    const tool = result[0] as { name: string; description: string; input_schema: Record<string, unknown> };
    expect(tool.name).toBe("my_custom_tool");
    expect(tool.description).toBe("A custom tool");
    expect(tool.input_schema.type).toBe("object");
  });

  test("已有 input_schema 字段的工具（Anthropic 格式）原样透传", () => {
    const anthropicTool = {
      name: "passthrough_tool",
      input_schema: { type: "object", properties: {} },
    };
    // @ts-expect-error 测试透传 Anthropic 格式
    const result = mapTools([anthropicTool])!;
    expect(result[0]).toBe(anthropicTool);
  });

  test("falsy 工具被过滤掉", () => {
    // @ts-expect-error 测试 null/undefined 工具
    const result = mapTools([null, undefined, { type: "function", function: { name: "valid" } }])!;
    expect(result).toHaveLength(1);
  });

  test("function 工具的 cache_control 被透传到 Anthropic Tool", () => {
    const tools: OpenAITools = [
      {
        type: "function",
        function: { name: "cached_fn" },
        cache_control: { type: "ephemeral" },
      } as unknown as NonNullable<OpenAITools>[number],
    ];
    const result = mapTools(tools)!;
    const tool = result[0] as { cache_control?: unknown };
    expect(tool.cache_control).toEqual({ type: "ephemeral" });
  });

  test("多个工具被正确映射", () => {
    const tools: OpenAITools = [
      { type: "function", function: { name: "fn_a" } },
      { type: "function", function: { name: "fn_b", description: "B" } },
    ];
    const result = mapTools(tools)!;
    expect(result).toHaveLength(2);
    expect((result[0] as { name: string }).name).toBe("fn_a");
    expect((result[1] as { name: string }).name).toBe("fn_b");
  });
});

// ---------------------------------------------------------------------------
// mergeToolProviderFields
// ---------------------------------------------------------------------------

describe("mergeToolProviderFields", () => {
  test("source 无扩展字段时 target 原样返回（新对象）", () => {
    const target = { name: "fn", input_schema: { type: "object" as const } };
    const result = mergeToolProviderFields(target, {});
    expect(result).toEqual(target);
    expect(result).not.toBe(target);
  });

  test("cache_control 从 source 透传到 target", () => {
    const target = { name: "fn", input_schema: { type: "object" as const } };
    const result = mergeToolProviderFields(target, { cache_control: { type: "ephemeral" } });
    expect((result as { cache_control?: unknown }).cache_control).toEqual({ type: "ephemeral" });
  });

  test("source.cache_control 为 null 时不被合并", () => {
    const target = { name: "fn", input_schema: { type: "object" as const } };
    const result = mergeToolProviderFields(target, { cache_control: null });
    expect(Object.hasOwn(result, "cache_control")).toBe(false);
  });

  test("defer_loading 从 source 透传到 target", () => {
    const target = { name: "fn", input_schema: { type: "object" as const } };
    const result = mergeToolProviderFields(target, { defer_loading: true });
    expect((result as { defer_loading?: boolean }).defer_loading).toBe(true);
  });

  test("input_examples 从 source 透传到 target", () => {
    const examples = [{ q: "test" }];
    const target = { name: "fn", input_schema: { type: "object" as const } };
    const result = mergeToolProviderFields(target, { input_examples: examples });
    expect((result as { input_examples?: unknown }).input_examples).toBe(examples);
  });

  test("allowed_callers 从 source 透传到 target", () => {
    const target = { name: "fn", input_schema: { type: "object" as const } };
    const result = mergeToolProviderFields(target, { allowed_callers: ["direct"] });
    expect((result as { allowed_callers?: unknown }).allowed_callers).toEqual(["direct"]);
  });

  test("eager_input_streaming 从 source 透传到 target", () => {
    const target = { name: "fn", input_schema: { type: "object" as const } };
    const result = mergeToolProviderFields(target, { eager_input_streaming: true });
    expect((result as { eager_input_streaming?: boolean | null }).eager_input_streaming).toBe(true);
  });

  test("strict 从 source 透传到 target", () => {
    const target = { name: "fn", input_schema: { type: "object" as const } };
    const result = mergeToolProviderFields(target, { strict: true });
    expect((result as { strict?: boolean }).strict).toBe(true);
  });

  test("多个 provider-specific 字段组合透传", () => {
    const target = { name: "fn", input_schema: { type: "object" as const } };
    const result = mergeToolProviderFields(target, {
      cache_control: { type: "ephemeral" },
      defer_loading: true,
      eager_input_streaming: true,
      strict: false,
    });
    expect((result as any).cache_control).toEqual({ type: "ephemeral" });
    expect((result as any).defer_loading).toBe(true);
    expect((result as any).eager_input_streaming).toBe(true);
    expect((result as any).strict).toBe(false);
  });

  test("eager_input_streaming 为 null 时不被合并", () => {
    const target = { name: "fn", input_schema: { type: "object" as const } };
    const result = mergeToolProviderFields(target, { eager_input_streaming: null });
    expect(Object.hasOwn(result, "eager_input_streaming")).toBe(false);
  });
});

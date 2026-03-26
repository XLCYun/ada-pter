import type { OpenAICompletionConfig } from "./request-params";
import type { CacheControlEphemeral, MessageCreateParamsBase, Tool, ToolUnion } from "./types";

type AnthropicTools = MessageCreateParamsBase["tools"];
type OpenAITools = OpenAICompletionConfig["tools"];
type OpenAITool = NonNullable<OpenAITools>[number];
type AnthropicTool = NonNullable<AnthropicTools>[number];

export function mapTools(tools?: OpenAITools): AnthropicTools | undefined {
  if (!Array.isArray(tools)) return tools;

  return tools
    .map((tool) => {
      // Pass through Anthropic format tools unchanged
      if (tool && typeof tool === "object" && "input_schema" in tool) {
        return tool as unknown as Tool | ToolUnion;
      }

      return mapOneTool(tool);
    })
    .filter((tool): tool is Tool | ToolUnion => Boolean(tool));
}

/** Anthropic input_schema 只接受有限字段，过滤掉多余 key 避免接口报错（对齐 litellm transformation） */
const ALLOWED_INPUT_SCHEMA_KEYS = new Set(["type", "properties", "required"]);

function filterInputSchema(raw: Record<string, unknown>): Tool["input_schema"] {
  const filtered: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) {
    if (ALLOWED_INPUT_SCHEMA_KEYS.has(k)) filtered[k] = raw[k];
  }
  return { type: "object", ...filtered };
}

/**
 * Anthropic Tool:
 * {
 *   input_schema: {
 *     type: "object",
 *     properties?: { type: "object", "properties": {} };
 *     required?: Array<string> | null;
 *   },
 *   name: string;
 *   description?: string;
 * }
 */
function mapOneTool(tool: OpenAITool): AnthropicTool | undefined {
  if (!tool || typeof tool !== "object") return undefined;

  if (tool.type === "function") {
    /**
     * OpenAI function tool
     * {
     *   type: "function",
     *   function: {
     *     name: string;
     *     description?: string;
     *     parameters?: Record<string, unknown>;
     *   }
     * }
     */
    const fn = tool.function;
    const raw = fn.parameters ?? { type: "object", properties: {} };
    return mergeToolProviderFields(
      {
        name: fn.name,
        input_schema: filterInputSchema(raw),
        description: fn.description,
      },
      tool,
    );
  } else if (tool.type === "custom") {
    /**
     * OpenAI custom tool
     * {
     *   type: "custom",
     *   custom: {
     *     name: string;
     *     description?: string;
     *     format?: { type: "text" } | { type: "grammar", grammar: { definition: string, syntax: "lark" | "regex" } };
     *   }
     * }
     */
    return mergeToolProviderFields(
      {
        name: tool.custom.name,
        description: tool.custom.description ?? "",
        input_schema: { type: "object", properties: {} } satisfies Tool["input_schema"],
      },
      tool,
    );
  }

  // pass through other tool types unchanged
  return tool;
}

type ToolProviderFields = {
  cache_control?: CacheControlEphemeral | null;
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  defer_loading?: boolean;
  input_examples?: Array<{ [key: string]: unknown }>;
};

export const mergeToolProviderFields = <T extends object>(
  target: T,
  source: object & Partial<ToolProviderFields>,
): T => {
  const extra: Partial<ToolProviderFields> = {};
  if (source?.cache_control != null) extra.cache_control = source.cache_control;
  if (source?.allowed_callers != null) extra.allowed_callers = source.allowed_callers;
  if (source?.defer_loading != null) extra.defer_loading = source.defer_loading;
  if (source?.input_examples != null) extra.input_examples = source.input_examples;
  return { ...target, ...extra };
};

import type { AdapterContext } from "ada-pter";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionParamsBase,
} from "ada-pter/types/openai";
import { extractSystem, mapMessages } from "./map-messages";
import { mapTools } from "./map-tools";
import type { ResolvedThinkingOptions } from "./thinking";
import { ThinkingManager } from "./thinking";
import type {
  JSONOutputFormat,
  MessageCreateParamsBase,
  MessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming,
} from "./types/messages";
import { mapWebSearchTool } from "./web-search";

export type OpenAICompletionConfig = ChatCompletionParamsBase;

type AnthropicMessageCreateParams = MessageCreateParamsNonStreaming | MessageCreateParamsStreaming;

const hasToolCallBlocks = (messages: ChatCompletionMessageParam[]): boolean =>
  messages.some((m) => m.role === "assistant" && Array.isArray(m.tool_calls));

const anyAssistantMessageHasThinkingBlocks = (messages: ChatCompletionMessageParam[]): boolean =>
  messages.some((m) => m.role === "assistant" && Array.isArray(m.thinking_blocks) && m.thinking_blocks.length > 0);

const lastAssistantWithToolCallsHasNoThinkingBlocks = (messages: ChatCompletionMessageParam[]): boolean => {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && Array.isArray(m.tool_calls)) as
    | ChatCompletionAssistantMessageParam
    | undefined;

  if (!lastAssistant) return false;
  const thinkingBlocks = lastAssistant?.thinking_blocks;
  return !Array.isArray(thinkingBlocks) || thinkingBlocks.length === 0;
};

type OpenAIToolChoice = ChatCompletionParamsBase["tool_choice"];
type AnthropicToolChoice = MessageCreateParamsBase["tool_choice"];
const mapToolChoice = (
  toolChoice: OpenAIToolChoice,
  parallelToolCalls: OpenAICompletionConfig["parallel_tool_calls"],
): AnthropicToolChoice => {
  let tool: AnthropicToolChoice;
  if (toolChoice === "auto") tool = { type: "auto" };
  else if (toolChoice === "required") tool = { type: "any" };
  else if (toolChoice === "none") tool = { type: "none" };
  else if (toolChoice?.type === "function") tool = { type: "tool", name: toolChoice.function?.name };
  else if (toolChoice?.type === "custom") tool = { type: "tool", name: toolChoice.custom?.name };
  // anthropic doesn't support allowed_tools

  if (typeof parallelToolCalls === "boolean" && tool?.type !== "none") {
    const disableObj = { disable_parallel_tool_use: !parallelToolCalls } as AnthropicToolChoice;
    tool = tool ? { ...tool, ...disableObj } : { type: "auto", ...disableObj };
  }
  return tool;
};

/**
 * Maps OpenAI service_tier to Anthropic's "auto" | "standard_only".
 *
 * OpenAI semantics (latency / cost / priority):
 * - auto:       follow deployment config; default for all users.
 * - default:    standard latency, standard pricing, medium priority; general production.
 * - flex:       high/variable latency, 50% discount, low priority; batch / non-realtime.
 * - scale:      very low latency, committed pricing, high priority; enterprise, large stable load.
 * - priority:   lowest latency, premium pricing, highest priority; latency-sensitive critical workloads.
 *
 * Anthropic semantics (differs from OpenAI):
 * - auto:           try higher-priority tier first, fall back to standard if unavailable.
 * - standard_only:  use standard tier only.
 *
 * Mapping:
 * - default, flex   → standard_only  (standard-tier / cost-sensitive use).
 * - auto, scale, priority  → auto      (default or latency-sensitive; let Anthropic try higher priority).
 * - null / undefined      → undefined (omit; API default).
 */
const mapServiceTier = (
  serviceTier: OpenAICompletionConfig["service_tier"],
): MessageCreateParamsBase["service_tier"] =>
  serviceTier === "default" || serviceTier === "flex"
    ? "standard_only"
    : serviceTier === "auto" || serviceTier === "scale" || serviceTier === "priority"
      ? "auto"
      : undefined;

const ANTHROPIC_BETA = {
  EFFORT_2025_11_24: "effort-2025-11-24",
  WEB_FETCH_2025_09_10: "web-fetch-2025-09-10",
  WEB_SEARCH_2025_03_05: "web-search-2025-03-05",
  STRUCTURED_OUTPUT_2025_11_13: "structured-outputs-2025-11-13",
} as const;

/**
 * Collect anthropic-beta header values from config and mapped tools.
 */
function collectAnthropicBetaValues(
  cfg: OpenAICompletionConfig,
  mappedTools: NonNullable<AnthropicMessageCreateParams["tools"]>,
  effortUsed: boolean,
): string[] {
  const betas = new Set<string>();
  if (effortUsed) betas.add(ANTHROPIC_BETA.EFFORT_2025_11_24);
  mappedTools.some((tool) => tool?.type?.startsWith("web_fetch")) && betas.add(ANTHROPIC_BETA.WEB_FETCH_2025_09_10);
  mappedTools.some((tool) => tool?.type === "web_search_20250305") && betas.add(ANTHROPIC_BETA.WEB_SEARCH_2025_03_05);
  if (cfg.response_format != null) betas.add(ANTHROPIC_BETA.STRUCTURED_OUTPUT_2025_11_13);
  return [...betas];
}

/**
 * Maps OpenAI response_format to Anthropic output_config.format.
 * - type "json_schema" with json_schema.schema: uses that schema (OpenAI standard only; no response_schema).
 * - type "json_object": uses JSON Schema { type: "object" } (any object).
 * Returns undefined when type is "text", missing, or for json_schema when schema is not present.
 */
function mapResponseFormatToOutputConfigFormat(
  responseFormat: OpenAICompletionConfig["response_format"],
): JSONOutputFormat | undefined {
  if (typeof responseFormat !== "object") return undefined;
  if (responseFormat.type === "text") return undefined;
  if (responseFormat.type === "json_object") return { type: "json_schema", schema: { type: "object" } };
  if (responseFormat.type !== "json_schema") return undefined;
  const schema = responseFormat.json_schema?.schema;
  if (schema == null || typeof schema !== "object") return undefined;
  return { type: "json_schema", schema };
}

export const buildBody = (
  ctx: AdapterContext,
  options: ResolvedThinkingOptions,
): { body: AnthropicMessageCreateParams; anthropicBetaValues: string[] } => {
  const cfg = ctx.config as OpenAICompletionConfig;
  const messages = cfg.messages ?? [];
  const thinkingManager = new ThinkingManager(options, cfg);

  // Anthropic doesn't support tool calling without `tools` param specified.
  const needsDummyTool = !cfg.tools && hasToolCallBlocks(messages);
  const toolsInput: OpenAICompletionConfig["tools"] = !needsDummyTool
    ? cfg.tools
    : [
        {
          type: "function" as const,
          function: {
            name: "__dummy_tool__",
            description: "This is a dummy tool call",
            parameters: { type: "object" },
          },
        },
      ];
  const mappedToolsBase = mapTools(toolsInput) ?? [];
  const webSearchTool =
    cfg.web_search_options != null && typeof cfg.web_search_options === "object"
      ? mapWebSearchTool(cfg.web_search_options)
      : null;
  const mappedTools = webSearchTool ? [...mappedToolsBase, webSearchTool] : mappedToolsBase;

  // Map reasoning_effort to thinking when thinking not explicitly provided
  let mappedThinking = thinkingManager.resolveThinking();
  // Drop thinking if assistant tool calls lack thinking blocks and none have thinking
  if (lastAssistantWithToolCallsHasNoThinkingBlocks(messages) && !anyAssistantMessageHasThinkingBlocks(messages)) {
    mappedThinking = undefined;
  }
  let { output_config, effortUsed } = thinkingManager.resolveEffort();
  if (output_config?.format == null) {
    const formatFromResponse = mapResponseFormatToOutputConfigFormat(cfg.response_format);
    if (formatFromResponse != null) {
      output_config = { ...output_config, format: formatFromResponse };
    }
  }

  const { systemBlocks, rest } = extractSystem(messages);
  const anthropicMessages = mapMessages(rest);

  const stopSequences = Array.isArray(cfg.stop) ? cfg.stop : typeof cfg.stop === "string" ? [cfg.stop] : undefined;

  const tool_choice = mapToolChoice(cfg.tool_choice, cfg.parallel_tool_calls);
  const service_tier = mapServiceTier(cfg.service_tier);

  const body: AnthropicMessageCreateParams = {
    model: ctx.model,
    max_tokens: cfg.max_completion_tokens ?? cfg.max_tokens ?? 4096,
    messages: anthropicMessages,
    system: systemBlocks.length ? systemBlocks : undefined,
    tools: mappedTools.length ? mappedTools : undefined,
    tool_choice,
    metadata: cfg?.metadata?.user_id != null ? { user_id: cfg.metadata.user_id } : undefined,
    stop_sequences: stopSequences,
    temperature: cfg.temperature ?? undefined,
    top_p: cfg.top_p ?? undefined,
    top_k: cfg.top_k ?? undefined,
    // anthropic_beta, anthropic_version are actually headers
    // count_tokens
    thinking: mappedThinking,
    // citations
    output_config,
    cache_control: cfg.cache_control,
    // container
    // inference_geo
    service_tier,
    stream: cfg.stream ?? false,
  };

  const anthropicBetaValues = collectAnthropicBetaValues(cfg, mappedTools, effortUsed);
  return { body, anthropicBetaValues };
};

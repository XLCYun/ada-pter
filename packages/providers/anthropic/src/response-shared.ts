import { createRequire } from "node:module";
import type { ChatCompletionChoice, CompletionUsage, ServerToolUseUsage, ThinkingBlock } from "ada-pter/types/openai";
import type { Tiktoken } from "js-tiktoken/lite";
import type {
  Usage as AnthropicUsage,
  BashCodeExecutionToolResultBlock,
  Citation,
  CodeExecutionToolResultBlock,
  ContainerUploadBlock,
  StopReason,
  TextEditorCodeExecutionToolResultBlock,
  ToolSearchToolResultBlock,
  WebFetchToolResultBlock,
  WebSearchToolResultBlock,
} from "./types/messages";

const requireModule = createRequire(import.meta.url);

/** Lazy-loaded cl100k_base encoder for reasoning token count. Throws if js-tiktoken cannot be loaded. */
let cl100kEncoder: Tiktoken | null = null;
function getCl100kEncoder(): Tiktoken {
  if (cl100kEncoder != null) return cl100kEncoder;
  const { Tiktoken } = requireModule("js-tiktoken/lite");
  const cl100k_base = requireModule("js-tiktoken/ranks/cl100k_base");
  cl100kEncoder = new Tiktoken(cl100k_base);
  return cl100kEncoder!;
}

/**
 * Counts tokens in reasoning content using js-tiktoken (cl100k_base).
 * Throws if js-tiktoken cannot be loaded or encode fails.
 */
export function countReasoningTokens(text: string): number {
  if (text.length === 0) return 0;
  const enc = getCl100kEncoder();
  return enc.encode(text).length;
}

/**
 * Anthropic-specific payload mirrored into OpenAI-style `provider_specific_fields`
 * (non-streaming assistant message or streaming chunk deltas).
 */
export type ProviderSpecificFields = {
  /** Non-streaming: citations grouped per text segment (with supported_text enrichment). */
  citations?: (Citation & { supported_text: string })[][];
  /** Streaming: incremental single citation from citations_delta. */
  citation?: Citation;
  thinking_blocks?: ThinkingBlock[];
  web_search_results?: (WebSearchToolResultBlock | WebFetchToolResultBlock)[];
  tool_results?: (
    | CodeExecutionToolResultBlock
    | BashCodeExecutionToolResultBlock
    | TextEditorCodeExecutionToolResultBlock
    | ToolSearchToolResultBlock
  )[];
  container_uploads?: ContainerUploadBlock[];
};

type FinishReason = ChatCompletionChoice["finish_reason"];

function mapServerToolUse(raw: AnthropicUsage["server_tool_use"]): ServerToolUseUsage | undefined {
  if (raw == null) return undefined;
  const out: ServerToolUseUsage = {};
  if (raw.web_search_requests != null) out.web_search_requests = raw.web_search_requests;
  const toolSearch = (raw as { tool_search_requests?: number }).tool_search_requests;
  if (toolSearch != null) out.tool_search_requests = toolSearch;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Maps Anthropic stop_reason to OpenAI finish_reason.
 */
export function mapFinishReason(stopReason: StopReason | null): FinishReason {
  if (stopReason == null) return "stop";
  switch (stopReason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    case "refusal":
      return "content_filter";
    // pause_turn, end_turn => stop
    default:
      return "stop";
  }
}

/**
 * Maps Anthropic Usage to OpenAI CompletionUsage.
 * - Uses js-tiktoken for reasoning_tokens when reasoning content is present.
 * - Includes server_tool_use from API (web_search_requests, tool_search_requests when present), cache tokens, and cache_creation_token_details.
 */
export function mapUsage(usage: AnthropicUsage, reasoningContent: string | null): CompletionUsage {
  let promptTokens = usage.input_tokens ?? 0;
  const cacheCreation = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  promptTokens += cacheCreation + cacheRead;

  const completionTokens = usage.output_tokens ?? 0;
  const totalTokens = promptTokens + completionTokens;

  const reasoningTokens =
    reasoningContent != null && reasoningContent.length > 0 ? countReasoningTokens(reasoningContent) : 0;

  const prompt_tokens_details: CompletionUsage["prompt_tokens_details"] = {
    cached_tokens: cacheRead,
  };

  const result: CompletionUsage = {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    completion_tokens_details: {
      reasoning_tokens: reasoningTokens,
    },
    prompt_tokens_details,
    server_tool_use: mapServerToolUse(usage.server_tool_use),
  };
  return result;
}

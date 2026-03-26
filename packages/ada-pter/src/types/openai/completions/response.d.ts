import type { ThinkingBlock } from "./extend";
import type { ChatCompletionMessageFunctionCall, ChatCompletionMessageToolCall } from "./shared";

/** Usage types */
export interface CompletionUsageDetails {
  [key: string]: unknown;
}

/** Server-side tool use counts (e.g. Anthropic web_search_requests, tool_search_requests). */
export interface ServerToolUseUsage {
  web_search_requests?: number;
  tool_search_requests?: number;
}

export interface CompletionUsage {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
  completion_tokens_details?: CompletionUsageDetails;
  prompt_tokens_details?: CompletionUsageDetails;
  /** Server tool use counts; used by Anthropic and others. */
  server_tool_use?: ServerToolUseUsage;
}

/** Message annotation types */
export interface ChatCompletionMessageAnnotationURLCitation {
  end_index: number;
  start_index: number;
  title: string;
  url: string;
}

export interface ChatCompletionMessageAnnotation {
  type: "url_citation";
  url_citation: ChatCompletionMessageAnnotationURLCitation;
}

/** Logprobs (token → choice) */
export interface ChatCompletionTokenLogprobTopLogprob {
  token: string;
  bytes: Array<number> | null;
  logprob: number;
}

export interface ChatCompletionTokenLogprob {
  token: string;
  bytes: Array<number> | null;
  logprob: number;
  top_logprobs: Array<ChatCompletionTokenLogprobTopLogprob>;
}

export interface ChatCompletionChoiceLogprobs {
  content: Array<ChatCompletionTokenLogprob> | null;
  refusal: Array<ChatCompletionTokenLogprob> | null;
}

export interface ChatCompletionChunkChoiceLogprobs {
  content: Array<ChatCompletionTokenLogprob> | null;
  refusal: Array<ChatCompletionTokenLogprob> | null;
}

/** Message & audio */
export interface ChatCompletionAudio {
  id: string;
  data: string;
  expires_at: number;
  transcript: string;
}

export interface ChatCompletionMessage {
  content: string | null;
  refusal: string | null;
  role: "assistant";
  annotations?: Array<ChatCompletionMessageAnnotation>;
  audio?: ChatCompletionAudio | null;
  function_call?: ChatCompletionMessageFunctionCall | null;
  tool_calls?: Array<ChatCompletionMessageToolCall>;

  // add thinking blocks and reasoning content support
  thinking_blocks?: ThinkingBlock[];
  reasoning_content?: string | null;
}

/** Chunk delta */
export interface ChatCompletionChunkChoiceDeltaToolCallFunction {
  arguments?: string;
  name?: string;
}

export interface ChatCompletionChunkChoiceDeltaToolCall {
  index: number;
  id?: string;
  function?: ChatCompletionChunkChoiceDeltaToolCallFunction;
  type?: "function";
}

export interface ChatCompletionChunkChoiceDeltaFunctionCall {
  arguments?: string;
  name?: string;
}

export interface ChatCompletionChunkChoiceDelta {
  content?: string | null;
  function_call?: ChatCompletionChunkChoiceDeltaFunctionCall;
  refusal?: string | null;
  role?: "developer" | "system" | "user" | "assistant" | "tool";
  tool_calls?: Array<ChatCompletionChunkChoiceDeltaToolCall>;

  // add thinking blocks and reasoning content support
  thinking_blocks?: ThinkingBlock[];
  reasoning_content?: string | null;
}

/** Choice */
export interface ChatCompletionChunkChoice {
  delta: ChatCompletionChunkChoiceDelta;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | null;
  index: number;
  logprobs?: ChatCompletionChunkChoiceLogprobs | null;
}

export interface ChatCompletionChoice {
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call";
  index: number;
  logprobs: ChatCompletionChoiceLogprobs | null;
  message: ChatCompletionMessage;
}

/** Top-level responses */
/** non-streaming response */
export interface ChatCompletion {
  id: string;
  choices: Array<ChatCompletionChoice>;
  created: number;
  model: string;
  object: "chat.completion";
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;
  system_fingerprint?: string;
  usage?: CompletionUsage;
}

/** streaming response */
export interface ChatCompletionChunk {
  id: string;
  choices: Array<ChatCompletionChunkChoice>;
  created: number;
  model: string;
  object: "chat.completion.chunk";
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;
  system_fingerprint?: string;
  usage?: CompletionUsage | null;
}

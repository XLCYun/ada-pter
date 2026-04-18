import type { CacheControlEphemeral, ThinkingBlock } from "./extend";
import type { ChatCompletionMessageFunctionCall, ChatCompletionMessageToolCall } from "./shared";

export interface ChatCompletionParamsBase {
  messages: Array<ChatCompletionMessageParam>;
  model: string;
  temperature?: number | null;
  top_p?: number | null;
  n?: number | null;
  max_completion_tokens?: number | null;
  /** @deprecated */
  max_tokens?: number | null;
  stop?: string | null | Array<string>;
  seed?: number | null;
  frequency_penalty?: number | null;
  presence_penalty?: number | null;
  logit_bias?: { [key: string]: number } | null;
  response_format?: ResponseFormatParam;
  logprobs?: boolean | null;
  top_logprobs?: number | null;
  tools?: Array<ChatCompletionTool>;
  tool_choice?: ChatCompletionToolChoiceOption;
  /** @deprecated */
  function_call?: "none" | "auto" | ChatCompletionFunctionCallOption;
  /** @deprecated */
  functions?: Array<ChatCompletionCreateParamsFunction>;
  stream?: boolean | null;
  stream_options?: ChatCompletionStreamOptions | null;
  prompt_cache_key?: string;
  prompt_cache_retention?: "in-memory" | "24h" | null;
  store?: boolean | null;
  audio?: ChatCompletionAudioParam | null;
  modalities?: Array<"text" | "audio"> | null;
  metadata?: Metadata | null;
  parallel_tool_calls?: boolean;
  prediction?: ChatCompletionPredictionContent | null;
  reasoning_effort?: ReasoningEffort | null;
  safety_identifier?: string;
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;
  /** @deprecated */
  user?: string;
  verbosity?: "low" | "medium" | "high" | null;
  web_search_options?: ChatCompletionCreateParamsWebSearchOptions;

  // extends: cache control support
  // Supported providers: anthropic
  cache_control?: CacheControlEphemeral | null;
  // Supported providers: anthropic
  top_k?: number | null;
}

export interface ChatCompletionParamsNonStreaming extends ChatCompletionParamsBase {
  stream?: false | null;
}

export interface ChatCompletionParamsStreaming extends ChatCompletionParamsBase {
  stream: true;
}

export type ChatCompletionParams = ChatCompletionParamsNonStreaming | ChatCompletionParamsStreaming;

// ------------------------------------------------------
// Base and shared types
// ------------------------------------------------------
/** Type for the `metadata` parameter. */
export type Metadata = Record<string, string>;
/** Type for the `reasoning_effort` parameter. */
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | null;
export type FunctionParameters = Record<string, unknown>;
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: FunctionParameters;
}
/** Type for the `response_format` parameter. */
export type ResponseFormatParam = ResponseFormatText | ResponseFormatJSONObject | ResponseFormatJSONSchema;
export type ResponseFormatText = { type: "text" };
export type ResponseFormatJSONObject = { type: "json_object" };
export type ResponseFormatJSONSchema = {
  type: "json_schema";
  json_schema: {
    name: string;
    description?: string;
    schema?: { [key: string]: unknown };
    strict?: boolean | null;
  };
};

// ------------------------------------------------------
// Message types
// ------------------------------------------------------
export interface ChatCompletionSystemMessageParam {
  content: string | Array<ChatCompletionContentPartText>;
  role: "system";
  name?: string;
}

export interface ChatCompletionUserMessageParam {
  content: string | Array<ChatCompletionContentPart>;
  role: "user";
  name?: string;
}

export interface ChatCompletionAssistantMessageParam {
  role: "assistant";
  content?: string | Array<ChatCompletionContentPartText | ChatCompletionContentPartRefusal> | null;
  refusal?: string | null;
  name?: string;
  /** @deprecated */
  function_call?: ChatCompletionMessageFunctionCall | null;
  tool_calls?: Array<ChatCompletionMessageToolCall>;

  /** thinking blocks */
  thinking_blocks?: ThinkingBlock[];
}

export interface ChatCompletionToolMessageParam {
  content: string | Array<ChatCompletionContentPartText>;
  role: "tool";
  tool_call_id: string;
}

export interface ChatCompletionFunctionMessageParam {
  content: string | null;
  name: string;
  role: "function";
}

export interface ChatCompletionDeveloperMessageParam {
  content: string | Array<ChatCompletionContentPartText>;
  role: "developer";
  name?: string;
}

/** Type for the `messages` parameter. */
export type ChatCompletionMessageParam =
  | ChatCompletionDeveloperMessageParam
  | ChatCompletionSystemMessageParam
  | ChatCompletionUserMessageParam
  | ChatCompletionAssistantMessageParam
  | ChatCompletionToolMessageParam
  | ChatCompletionFunctionMessageParam;

// ------------------------------------------------------
// Content part types
// ------------------------------------------------------
export interface ChatCompletionContentPartText extends CacheControlEphemeral {
  text: string;
  type: "text";
}

export interface ChatCompletionContentPartImageImageURL {
  url: string;
  detail?: "auto" | "low" | "high";
}

export interface ChatCompletionContentPartImage extends CacheControlEphemeral {
  image_url: ChatCompletionContentPartImageImageURL;
  type: "image_url";
}

export interface ChatCompletionContentPartInputAudioData {
  data: string;
  format: "wav" | "mp3";
}

export interface ChatCompletionContentPartInputAudio extends CacheControlEphemeral {
  input_audio: ChatCompletionContentPartInputAudioData;
  type: "input_audio";
}

export interface ChatCompletionContentPartRefusal {
  refusal: string;
  type: "refusal";
}

export interface ChatCompletionContentPartFileData {
  file_data?: string;
  file_id?: string;
  filename?: string;
}

export interface ChatCompletionContentPartFile extends CacheControlEphemeral {
  file: ChatCompletionContentPartFileData;
  type: "file";
}

export type ChatCompletionContentPart =
  | ChatCompletionContentPartText
  | ChatCompletionContentPartImage
  | ChatCompletionContentPartInputAudio
  | ChatCompletionContentPartFile;

// ------------------------------------------------------
// Tool and tool choice types
// ------------------------------------------------------
/** Type for the `functions` parameter. */
export interface ChatCompletionCreateParamsFunction {
  name: string;
  description?: string;
  parameters?: FunctionParameters;
}

/** Type for the `function_call` parameter. */
export interface ChatCompletionFunctionCallOption {
  name: string;
}

export interface ChatCompletionFunctionTool {
  function: FunctionDefinition;
  type: "function";
}

export interface ChatCompletionCustomToolGrammarGrammar {
  definition: string;
  syntax: "lark" | "regex";
}

export type ChatCompletionCustomToolCustomGrammar = {
  grammar: ChatCompletionCustomToolGrammarGrammar;
  type: "grammar";
};

export interface ChatCompletionCustomToolCustomText {
  type: "text";
}

export type ChatCompletionCustomToolCustomFormat =
  | ChatCompletionCustomToolCustomText
  | ChatCompletionCustomToolCustomGrammar;

export interface ChatCompletionCustomToolCustom {
  name: string;
  description?: string;
  format?: ChatCompletionCustomToolCustomFormat;
}

export interface ChatCompletionCustomTool {
  custom: ChatCompletionCustomToolCustom;
  type: "custom";
}
/** Type for the `tools` parameter. */
export type ChatCompletionTool = ChatCompletionFunctionTool | ChatCompletionCustomTool;

/** Type for the `tool_choice` parameter. */
export type ChatCompletionToolChoiceOption =
  | "none"
  | "auto"
  | "required"
  | ChatCompletionAllowedToolChoice
  | ChatCompletionNamedToolChoice
  | ChatCompletionNamedToolChoiceCustom;

export interface ChatCompletionAllowedTools {
  mode: "auto" | "required";
  tools: Array<{ [key: string]: unknown }>;
}

export interface ChatCompletionAllowedToolChoice {
  allowed_tools: ChatCompletionAllowedTools;
  type: "allowed_tools";
}

export interface ChatCompletionNamedToolChoiceFunction {
  name: string;
}

export interface ChatCompletionNamedToolChoice {
  function: ChatCompletionNamedToolChoiceFunction;
  type: "function";
}

export interface ChatCompletionNamedToolChoiceCustomCustom {
  name: string;
}

export interface ChatCompletionNamedToolChoiceCustom {
  custom: ChatCompletionNamedToolChoiceCustomCustom;
  type: "custom";
}

// ------------------------------------------------------
// Other param types
// ------------------------------------------------------
/** Type for the `audio` parameter. */
export interface ChatCompletionAudioParam {
  format: "wav" | "aac" | "mp3" | "flac" | "opus" | "pcm16";
  voice:
    | (string & {})
    | "alloy"
    | "ash"
    | "ballad"
    | "coral"
    | "echo"
    | "fable"
    | "nova"
    | "onyx"
    | "sage"
    | "shimmer"
    | "marin"
    | "cedar";
}

/** Type for the `prediction` parameter. */
export interface ChatCompletionPredictionContent {
  content: string | Array<ChatCompletionContentPartText>;
  type: "content";
}

/** Type for the `stream_options` parameter. */
export interface ChatCompletionStreamOptions {
  include_obfuscation?: boolean;
  include_usage?: boolean;
}

export interface ChatCompletionCreateParamsWebSearchOptionsUserLocationApproximate {
  city?: string;
  country?: string;
  region?: string;
  timezone?: string;
}

export interface ChatCompletionCreateParamsWebSearchOptionsUserLocation {
  approximate: ChatCompletionCreateParamsWebSearchOptionsUserLocationApproximate;
  type: "approximate";
}

/** Type for the `web_search_options` parameter. */
export interface ChatCompletionCreateParamsWebSearchOptions {
  search_context_size?: "low" | "medium" | "high";
  user_location?: ChatCompletionCreateParamsWebSearchOptionsUserLocation | null;
}

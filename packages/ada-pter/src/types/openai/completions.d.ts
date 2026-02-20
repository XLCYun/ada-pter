// OpenAI chat.completions

export declare namespace Shared {
  export type ChatModel = string;

  export type Metadata = Record<string, string>;

  export type ReasoningEffort =
    | "none"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh";

  export type FunctionParameters = Record<string, unknown>;

  export interface FunctionDefinition {
    name: string;
    description?: string;
    parameters?: FunctionParameters;
  }

  export type ResponseFormatText = { type: "text" };

  export type ResponseFormatJSONObject = { type: "json_object" };

  export type ResponseFormatJSONSchema = {
    type: "json_schema";
    json_schema: {
      name: string;
      description?: string;
      schema: Record<string, unknown>;
      strict?: boolean;
    };
  };
}

export interface ChatCompletionAudio {
  id: string;
  data: string;
  expires_at: number;
  transcript: string;
}

export interface ChatCompletionAudioParam {
  format: "wav" | "aac" | "mp3" | "flac" | "opus" | "pcm16";
  voice:
    | (string & {})
    | "alloy"
    | "ash"
    | "ballad"
    | "coral"
    | "echo"
    | "sage"
    | "shimmer"
    | "verse"
    | "marin"
    | "cedar";
}

export type ChatCompletionContentPart =
  | ChatCompletionContentPartText
  | ChatCompletionContentPartImage
  | ChatCompletionContentPartInputAudio
  | ChatCompletionContentPart.File;

export declare namespace ChatCompletionContentPart {
  export interface File {
    file: File.File;
    type: "file";
  }

  export declare namespace File {
    export interface File {
      file_data?: string;
      file_id?: string;
      filename?: string;
    }
  }
}

export interface ChatCompletionContentPartImage {
  image_url: ChatCompletionContentPartImage.ImageURL;
  type: "image_url";
}

export declare namespace ChatCompletionContentPartImage {
  export interface ImageURL {
    url: string;
    detail?: "auto" | "low" | "high";
  }
}

export interface ChatCompletionContentPartInputAudio {
  input_audio: ChatCompletionContentPartInputAudio.InputAudio;
  type: "input_audio";
}

export declare namespace ChatCompletionContentPartInputAudio {
  export interface InputAudio {
    data: string;
    format: "wav" | "mp3";
  }
}

export interface ChatCompletionContentPartRefusal {
  refusal: string;
  type: "refusal";
}

export interface ChatCompletionContentPartText {
  text: string;
  type: "text";
}

export interface ChatCompletionCustomTool {
  custom: ChatCompletionCustomTool.Custom;
  type: "custom";
}

export declare namespace ChatCompletionCustomTool {
  export interface Custom {
    name: string;
    description?: string;
    format?: Custom.Text | Custom.Grammar;
  }

  export declare namespace Custom {
    export interface Text {
      type: "text";
    }

    export interface Grammar {
      grammar: Grammar.Grammar;
      type: "grammar";
    }

    export declare namespace Grammar {
      export interface Grammar {
        definition: string;
        syntax: "lark" | "regex";
      }
    }
  }
}

export interface ChatCompletionDeveloperMessageParam {
  content: string | Array<ChatCompletionContentPartText>;
  role: "developer";
  name?: string;
}

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

export interface ChatCompletionMessageFunctionToolCall {
  id: string;
  function: ChatCompletionMessageFunctionToolCall.Function;
  type: "function";
}

export declare namespace ChatCompletionMessageFunctionToolCall {
  export interface Function {
    arguments: string;
    name: string;
  }
}

export interface ChatCompletionMessageCustomToolCall {
  id: string;
  custom: ChatCompletionMessageCustomToolCall.Custom;
  type: "custom";
}

export declare namespace ChatCompletionMessageCustomToolCall {
  export interface Custom {
    input: string;
    name: string;
  }
}

export type ChatCompletionMessageToolCall =
  | ChatCompletionMessageFunctionToolCall
  | ChatCompletionMessageCustomToolCall;

export interface ChatCompletionAssistantMessageParam {
  role: "assistant";
  content?: string | Array<ChatCompletionContentPartText> | null;
  refusal?: string | null;
  name?: string;
  tool_calls?: Array<ChatCompletionMessageToolCall>;
}

export type ChatCompletionMessageParam =
  | ChatCompletionDeveloperMessageParam
  | ChatCompletionSystemMessageParam
  | ChatCompletionUserMessageParam
  | ChatCompletionAssistantMessageParam
  | ChatCompletionToolMessageParam
  | ChatCompletionFunctionMessageParam;

export interface ChatCompletionFunctionCallOption {
  name: string;
}

export interface ChatCompletionFunctionTool {
  function: Shared.FunctionDefinition;
  type: "function";
}

export type ChatCompletionTool =
  | ChatCompletionFunctionTool
  | ChatCompletionCustomTool;

export interface ChatCompletionNamedToolChoice {
  function: ChatCompletionNamedToolChoice.Function;
  type: "function";
}

export declare namespace ChatCompletionNamedToolChoice {
  export interface Function {
    name: string;
  }
}

export interface ChatCompletionNamedToolChoiceCustom {
  custom: ChatCompletionNamedToolChoiceCustom.Custom;
  type: "custom";
}

export declare namespace ChatCompletionNamedToolChoiceCustom {
  export interface Custom {
    name: string;
  }
}

export interface ChatCompletionAllowedTools {
  mode: "auto" | "required";
  tools: Array<{ [key: string]: unknown }>;
}

export interface ChatCompletionAllowedToolChoice {
  allowed_tools: ChatCompletionAllowedTools;
  type: "allowed_tools";
}

export type ChatCompletionToolChoiceOption =
  | "none"
  | "auto"
  | "required"
  | ChatCompletionAllowedToolChoice
  | ChatCompletionNamedToolChoice
  | ChatCompletionNamedToolChoiceCustom;

export interface ChatCompletionPredictionContent {
  content: string | Array<ChatCompletionContentPartText>;
  type: "content";
}

export interface ChatCompletionStreamOptions {
  include_obfuscation?: boolean;
  include_usage?: boolean;
}

export type ChatCompletionReasoningEffort = Shared.ReasoningEffort | null;

export interface ChatCompletionCreateParamsBase {
  messages: Array<ChatCompletionMessageParam>;
  model: (string & {}) | Shared.ChatModel;
  audio?: ChatCompletionAudioParam | null;
  frequency_penalty?: number | null;
  /** @deprecated */
  function_call?: "none" | "auto" | ChatCompletionFunctionCallOption;
  /** @deprecated */
  functions?: Array<ChatCompletionCreateParams.Function>;
  logit_bias?: { [key: string]: number } | null;
  logprobs?: boolean | null;
  max_completion_tokens?: number | null;
  /** @deprecated */
  max_tokens?: number | null;
  metadata?: Shared.Metadata | null;
  modalities?: Array<"text" | "audio"> | null;
  n?: number | null;
  parallel_tool_calls?: boolean;
  prediction?: ChatCompletionPredictionContent | null;
  presence_penalty?: number | null;
  prompt_cache_key?: string;
  prompt_cache_retention?: "in-memory" | "24h" | null;
  reasoning_effort?: Shared.ReasoningEffort | null;
  response_format?:
    | Shared.ResponseFormatText
    | Shared.ResponseFormatJSONSchema
    | Shared.ResponseFormatJSONObject;
  safety_identifier?: string;
  seed?: number | null;
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;
  stop?: string | null | Array<string>;
  store?: boolean | null;
  stream?: boolean | null;
  stream_options?: ChatCompletionStreamOptions | null;
  temperature?: number | null;
  tool_choice?: ChatCompletionToolChoiceOption;
  tools?: Array<ChatCompletionTool>;
  top_logprobs?: number | null;
  top_p?: number | null;
  /** @deprecated */
  user?: string;
  verbosity?: "low" | "medium" | "high" | null;
  web_search_options?: ChatCompletionCreateParams.WebSearchOptions;
}

export declare namespace ChatCompletionCreateParams {
  export interface Function {
    name: string;
    description?: string;
    parameters?: Shared.FunctionParameters;
  }

  export interface WebSearchOptions {
    search_context_size?: "low" | "medium" | "high";
    user_location?: WebSearchOptions.UserLocation | null;
  }

  export declare namespace WebSearchOptions {
    export interface UserLocation {
      approximate: UserLocation.Approximate;
      type: "approximate";
    }

    export declare namespace UserLocation {
      export interface Approximate {
        city?: string;
        country?: string;
        region?: string;
        timezone?: string;
      }
    }
  }
}

export interface ChatCompletionCreateParamsNonStreaming
  extends ChatCompletionCreateParamsBase {
  stream?: false | null;
}

export interface ChatCompletionCreateParamsStreaming
  extends ChatCompletionCreateParamsBase {
  stream: true;
}

export type ChatCompletionCreateParams =
  | ChatCompletionCreateParamsNonStreaming
  | ChatCompletionCreateParamsStreaming;

// Response types

export declare namespace CompletionUsage {
  export interface Details {
    [key: string]: unknown;
  }
}

export interface CompletionUsage {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
  completion_tokens_details?: CompletionUsage.Details;
  prompt_tokens_details?: CompletionUsage.Details;
}

export interface ChatCompletion {
  id: string;
  choices: Array<ChatCompletion.Choice>;
  created: number;
  model: string;
  object: "chat.completion";
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;
  system_fingerprint?: string;
  usage?: CompletionUsage;
}

export declare namespace ChatCompletion {
  export interface Choice {
    finish_reason:
      | "stop"
      | "length"
      | "tool_calls"
      | "content_filter"
      | "function_call";
    index: number;
    logprobs: Choice.Logprobs | null;
    message: ChatCompletionMessage;
  }

  export declare namespace Choice {
    export interface Logprobs {
      content: Array<ChatCompletionTokenLogprob> | null;
      refusal: Array<ChatCompletionTokenLogprob> | null;
    }
  }
}

export interface ChatCompletionMessage {
  content: string | null;
  refusal: string | null;
  role: "assistant";
  annotations?: Array<ChatCompletionMessage.Annotation>;
  audio?: ChatCompletionAudio | null;
  function_call?: ChatCompletionMessage.FunctionCall | null;
  tool_calls?: Array<ChatCompletionMessageToolCall>;
}

export declare namespace ChatCompletionMessage {
  export interface Annotation {
    type: "url_citation";
    url_citation: Annotation.URLCitation;
  }

  export declare namespace Annotation {
    export interface URLCitation {
      end_index: number;
      start_index: number;
      title: string;
      url: string;
    }
  }

  export interface FunctionCall {
    arguments: string;
    name: string;
  }
}

export interface ChatCompletionTokenLogprob {
  token: string;
  bytes: Array<number> | null;
  logprob: number;
  top_logprobs: Array<ChatCompletionTokenLogprob.TopLogprob>;
}

export declare namespace ChatCompletionTokenLogprob {
  export interface TopLogprob {
    token: string;
    bytes: Array<number> | null;
    logprob: number;
  }
}

export interface ChatCompletionChunk {
  id: string;
  choices: Array<ChatCompletionChunk.Choice>;
  created: number;
  model: string;
  object: "chat.completion.chunk";
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;
  system_fingerprint?: string;
  usage?: CompletionUsage | null;
}

export declare namespace ChatCompletionChunk {
  export interface Choice {
    delta: Choice.Delta;
    finish_reason:
      | "stop"
      | "length"
      | "tool_calls"
      | "content_filter"
      | "function_call"
      | null;
    index: number;
    logprobs?: Choice.Logprobs | null;
  }

  export declare namespace Choice {
    export interface Delta {
      content?: string | null;
      function_call?: Delta.FunctionCall;
      refusal?: string | null;
      role?: "developer" | "system" | "user" | "assistant" | "tool";
      tool_calls?: Array<Delta.ToolCall>;
    }

    export declare namespace Delta {
      export interface FunctionCall {
        arguments?: string;
        name?: string;
      }

      export interface ToolCall {
        index: number;
        id?: string;
        function?: ToolCall.Function;
        type?: "function";
      }

      export declare namespace ToolCall {
        export interface Function {
          arguments?: string;
          name?: string;
        }
      }
    }

    export interface Logprobs {
      content: Array<ChatCompletionTokenLogprob> | null;
      refusal: Array<ChatCompletionTokenLogprob> | null;
    }
  }
}

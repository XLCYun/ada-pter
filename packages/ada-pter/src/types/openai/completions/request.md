# Request

## Message Type Definition

```typescript
export interface CacheControlEphemeral {
  type: "ephemeral";
  ttl?: "5m" | "1h";
}

export type ChatCompletionMessageParam = {
        content: { text: string; type: "text" } & CacheControlEphemeral | string;
        role: "developer";
        name?: string;
    } | {
        content: { text: string; type: "text" } & CacheControlEphemeral | string;
        role: "system";
        name?: string;
    } | {
        content: (
            | { text: string; type: "text" } & CacheControlEphemeral
            | { type: "image_url", image_url: { url: string, details?: "auto" | "low" | "high" }}
            | { type: "input_audio", input_audio: { format: "wav" | "mp3", data: string }}
            | { type: "file", file: { file_id?: string, filename?: string, file_data?: string }}
        )[] | string;
        role: "user";
        name?: string;
    } | {
        role: "assistant";
        content?: (
            ({ text: string; type: "text" } & CacheControlEphemeral) | 
            { refusal: string; type: "refusal" }
        )[] | string | null;
        refusal?: string | null;
        name?: string;
        /** @deprecated */
        function_call?: { name: string; arguments: string; } | null
        tool_calls?: (
            {
                id: string
                type: "function"
                function: { name: string; arguments: string; }
            } | {
                id: string
                type: "custom
                custom: { name: string input: string }
            }
        )[]

        /** thinking blocks */
        thinking_blocks?: (
            | { type: "redacted_thinking"; data: string;  }
            | { type: "thinking"; signature: string; thinking: string;  }
        )[]
    } | {
        role: "tool";
        tool_call_id: string;
        content: ({ text: string; type: "text" } & CacheControlEphemeral)[] | string
    } | {
        role: "function";
        name: string;
        content: string | null;
    }
```

## Request Params

```typescript
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
  logprobs?: boolean | null;
  top_logprobs?: number | null;

  response_format?: { type: "text" } | { type: "json_object" } | {
    type: "json_schema";
    json_schema: {
      name: string;
      description?: string;
      schema?: { [key: string]: unknown };
      strict?: boolean | null;
    };
  };

  tools?: (
    {
        type: "function",
        function: {
            name: string
            description?: string
            parameters: Record<string, unknown>
        }
    } | {
        type: "custom",
        custom: {
            name: string
            description?: string
            format: { type: "text" } | {
                type: "grammar",
                grammar: { syntax: "lark" | "regex", definition: string }
            }
        }
    }
  )[];

  tool_choice?: "none" | "auto" | "required" | {
    type: "allowed_tools",
    allowed_tools: { mode: "auto" | "required", tools: Record<string, unknown>[] }
  } | {
    type: "function",
    function: { name: string }
  } | {
    type: "custom",
    custom: { name: string }
  };

  /** @deprecated */
  function_call?: "none" | "auto" | { name: string };
  /** @deprecated */
  functions?: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }[]
  stream?: boolean | null
  stream_options?: {
    include_obfuscation?: boolean
    include_usage?: boolean
  } | null
  prompt_cache_key?: string;
  prompt_cache_retention?: "in-memory" | "24h" | null;
  store?: boolean | null;
  audio?: {
    format: "wav" | "aac" | "mp3" | "flac" | "opus" | "pcm16";
    voice: string // alloy, ash...
  } | null;
  modalities?: Array<"text" | "audio"> | null;
  metadata?: Record<string, string> | null;
  parallel_tool_calls?: boolean;
  prediction?: {
    type: "content",
    content: { type: "text", text: string }
  } | null;
  reasoning_effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | null
  safety_identifier?: string;
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;
  /** @deprecated */
  user?: string;
  verbosity?: "low" | "medium" | "high" | null;
  web_search_options?: {
    search_context_size?: "low" | "medium" | "high";
    user_location?: {
      type: "approximate"
      approximate: {
        city?: string;
        country?: string;
        region?: string;
        timezone?: string;
      }
    } | null;
  }

  // extends: cache control support
  // Supported providers: anthropic
  cache_control?: {
    type: "ephemeral";
    ttl?: "5m" | "1h";
  } | null;
  // Supported providers: anthropic
  top_k?: number | null;
}
```









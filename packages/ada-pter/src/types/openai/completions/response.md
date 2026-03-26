# Response

The general response type and stream chunk only differ by two fields:

1. In the response type, the value of `object` is `"chat.completion"`, while in the stream chunk it is `"chat.completion.chunk"`.
2. The response type includes the field `choices.message`, whereas the stream chunk has `choices.delta`.

## Response Type

```typescript
{
    choices: {
        message: {
            content: string | null;
            refusal: string | null;
            role: "assistant";
            function_call?: {
                arguments: string;
                name: string;
            } | null;
            tool_calls?: (
                {
                    type: "function";
                    id: string;
                    function: {
                        arguments: string;
                        name: string;
                    }
                } | {
                    type: "custom";
                    id: string;
                    custom: {
                        input: string;
                        name: string;
                    };
                }
            )[];
            audio?: {
                id: string;
                data: string;
                expires_at: number;
                transcript: string;
            } | null;
            annotations?: {
                type: "url_citation";
                url_citation: {
                    end_index: number;
                    start_index: number;
                    title: string;
                    url: string;
                }
            }[];

            // add thinking blocks and reasoning content support
            thinking_blocks?: ThinkingBlock[];
            reasoning_content?: string | null;
        }

        // These three fields are same as the fields of the stream chunk
        finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call";
        index: number;
        logprobs?: null | {
            content: null | {
                token: string
                bytes: null | number[]
                logprob: number
                top_logprobs: {
                    token: string
                    bytes: null | number[]
                    logprob: number
                }[]
            }
            refusal: null | {
                token: string
                bytes: null | number[]
                logprob: number
                top_logprobs: {
                    token: string
                    bytes: null | number[]
                    logprob: number
                }[]
            }
        }
    }[];
    object: "chat.completion";
    // fields below are same as those from the stream chunk
    id: string;
    created: number;
    model: string;
    service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;
    system_fingerprint?: string;
    usage?: usage?: {
    completion_tokens: number
    prompt_tokens: number
    total_tokens: number
    completion_tokens_details ?: { [key: string]: unknown }
    prompt_tokens_details ?: CompletionUsageDetails
    /** Server tool use counts used by Anthropic and others. */
    server_tool_use ?: {
        web_search_requests?: number
        tool_search_requests?: number
    }
}
}
```

## Stream Chunk

```typescript
{
  id: string
  choices: {
    delta: {
        content?: string | null
        function_call?: {
            arguments?: string;
            name?: string;
        }
        refusal?: string | null
        role?: "developer" | "system" | "user" | "assistant" | "tool"
        tool_calls?: {
            index: number;
            id?: string;
            function?: {
                arguments?: string;
                name?: string;
            };
            type?: "function";
        }[]

        // add thinking blocks and reasoning content support
        thinking_blocks?: ThinkingBlock[];
        reasoning_content?: string | null;
    }[]
    // These three fields are same as the fields of the response type
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | null
    index: number
    logprobs?: null | {
        content: null | {
            token: string
            bytes: null | number[]
            logprob: number
            top_logprobs: {
                token: string
                bytes: null | number[]
                logprob: number
            }[]
        }
        refusal: null | {
            token: string
            bytes: null | number[]
            logprob: number
            top_logprobs: {
                token: string
                bytes: null | number[]
                logprob: number
            }[]
        }
    }
  }[]
  object: "chat.completion.chunk"
  // fields below are same as those from the response type
  created: number
  model: string
  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null
  system_fingerprint?: string
  usage?: null | {
    completion_tokens: number
    prompt_tokens: number
    total_tokens: number
    completion_tokens_details?: { [key: string]: unknown }
    prompt_tokens_details?: CompletionUsageDetails
    /** Server tool use counts used by Anthropic and others. */
    server_tool_use?: {
        web_search_requests?: number
        tool_search_requests?: number
    }
  }
}
```


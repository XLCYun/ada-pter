# Message Create

## Message Type Definition

```typescript
export interface CacheControlEphemeral {
  type: "ephemeral";
  ttl?: "5m" | "1h";
}

export type TextCitationParam =
  | {
    type: "char_location";
    cited_text: string;
    document_index: number;
    document_title: string | null;
    end_char_index: number;
    start_char_index: number;
  } | {
    type: "page_location";
    cited_text: string;
    document_index: number;
    document_title: string | null;
    end_page_number: number;
    start_page_number: number;
  } | {
    type: "content_block_location";
    cited_text: string;
    document_index: number;
    document_title: string | null;
    end_block_index: number;
    start_block_index: number;
  } | {
    type: "web_search_result_location";
    cited_text: string;
    encrypted_index: string;
    title: string | null;
    url: string;
  } | {
    type: "search_result_location";
    cited_text: string;
    end_block_index: number;
    search_result_index: number;
    source: string;
    start_block_index: number;
    title: string | null;
  }

type Caller = 
  | { type: "direct" }
  | { tool_id: string type: "code_execution_20250825" }
  | { tool_id: string type: "code_execution_20260120" }

export interface MessageParam {
  content: string | (
    // | TextBlockParam
    // | ImageBlockParam
    // | DocumentBlockParam
    | {
      type: "text";
      text: string;
      cache_control?: CacheControlEphemeral | null;
      citations?: TextCitationParam[] | null;
    }
    | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        data: string;
      } | { type: "url"; url: string };
      cache_control?: CacheControlEphemeral | null;
    }
    | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string; }
        | { type: "text"; media_type: "text/plain"; data: string; }
        | { type: "url"; url: string };
        | { type: "content"; content: string | (
            {
              type: "text";
              text: string;
              cache_control?: CacheControlEphemeral | null;
              citations?: Array<TextCitationParam> | null;
            } | {
              type: "image";
              source: Base64ImageSource | URLImageSource;
              cache_control?: CacheControlEphemeral | null;
            }
          )[]
        }
      cache_control?: CacheControlEphemeral | null;
      citations?: { enabled?: boolean } | null;
      context?: string | null;
      title?: string | null;
    }


    // | ToolUseBlockParam
    // | ServerToolUseBlockParam
    | {
        type: "tool_use"
        id: string
        name: string
        input: unknown
        cache_control?: CacheControlEphemeral | null
        caller?: Caller
      }
    | {
      type: "server_tool_use";
      id: string;
      name:
        | "web_search"
        | "web_fetch"
        | "code_execution"
        | "bash_code_execution"
        | "text_editor_code_execution"
        | "tool_search_tool_regex"
        | "tool_search_tool_bm25";
      input: unknown;
      cache_control?: CacheControlEphemeral | null;
      caller?: Caller
    }

    // | ToolSearchToolResultBlockParam
    // | SearchResultBlockParam
    // | ToolResultBlockParam
    // | WebSearchToolResultBlockParam
    // | WebFetchToolResultBlockParam
    // | CodeExecutionToolResultBlockParam
    // | BashCodeExecutionToolResultBlockParam
    // | TextEditorCodeExecutionToolResultBlockParam
    | {
      type: "tool_search_tool_result";
      tool_use_id: string;
      content: 
        | { type: "tool_search_tool_result_error" error_code: string }
        | {
          type: "tool_search_tool_search_result";
          tool_references: { type: "tool_reference" tool_name: string }
          }
      cache_control?: CacheControlEphemeral | null;
    }
    | {
        type: "search_result";
        content: {
          type: "text";
          text: string;
          cache_control?: CacheControlEphemeral | null;
          citations?: Array<TextCitationParam> | null;
        }[];
        source: string;
        title: string;
        cache_control?: CacheControlEphemeral | null;
        citations?: { enabled?: boolean };
    }
    | {
        type: "tool_result";
        tool_use_id: string;
        content?: 
          | string
          | {
              type: "tool_reference";
              tool_name: string;
              cache_control?: CacheControlEphemeral | null;
            }
          | TextBlockParam
          | ImageBlockParam
          | DocumentBlockParam
          | SearchResultBlockParam
        is_error?: boolean;
        cache_control?: CacheControlEphemeral | null;
    }
    | {
        type: "web_search_tool_result";
        tool_use_id: string;
        content: 
          | {
              type: "web_search_result";
              encrypted_content: string;
              title: string;
              url: string;
              page_age?: string | null;
            }
          | { type: "web_search_tool_result_error"; error_code: string }
        cache_control?: CacheControlEphemeral | null;
        caller?: Caller
      }
    | {
        type: "web_fetch_tool_result"
        tool_use_id: string
        content: 
          | { error_code:  string type: "web_fetch_tool_result_error" }
          | {
              content: DocumentBlockParam;
              type: "web_fetch_result";
              url: string;
              retrieved_at?: string | null;
            }
        cache_control?: CacheControlEphemeral | null
        caller?: Caller
      }
    | {
        type: "code_execution_tool_result";
        tool_use_id: string;
        content: 
          | { type: "code_execution_tool_result_error"; error_code: string }
          | {
              type: "code_execution_result";
              content: { type: "code_execution_output"; file_id: string }[]
              return_code: number;
              stderr: string;
              stdout: string;
          }
          | {
              type: "encrypted_code_execution_result"
              content: { type: "code_execution_output"; file_id: string }[]
              encrypted_stdout: string
              return_code: number
              stderr: string
          }
        cache_control?: CacheControlEphemeral | null;
    }
    | {
        type: "bash_code_execution_tool_result";
        tool_use_id: string;
        content: 
          | { type: "bash_code_execution_tool_result_error"; error_code: string }
          | {
              type: "bash_code_execution_result";
              content: { type: "bash_code_execution_output"; file_id: string }
              return_code: number;
              stderr: string;
              stdout: string;
          }
        cache_control?: CacheControlEphemeral | null;
    }
    | {
        type: "text_editor_code_execution_tool_result";
        tool_use_id: string;
        content: 
          | { type: "text_editor_code_execution_tool_result_error"; error_code: string; error_message?: string | null; }
          | {
            type: "text_editor_code_execution_view_result";
            content: string;
            file_type: "text" | "image" | "pdf";
            num_lines?: number | null;
            start_line?: number | null;
            total_lines?: number | null;
          }
          | {
              type: "text_editor_code_execution_create_result";
              is_file_update: boolean;
          } {
              type: "text_editor_code_execution_str_replace_result";
              lines?: Array<string> | null;
              new_lines?: number | null;
              new_start?: number | null;
              old_lines?: number | null;
              old_start?: number | null;
          }
        cache_control?: CacheControlEphemeral | null;
    }
    
    | {
        type: "container_upload";
        file_id: string;
        cache_control?: CacheControlEphemeral | null;
      }

    | { type: "thinking"; signature: string; thinking: string }
    | { type: "redacted_thinking"; data: string }
  )[]
  role: "user" | "assistant";
}
```

## Tool

```typescript
type ToolUnion = 
  | {
      type?: "custom" | null;
      input_schema: {
        type: "object";
        properties?: unknown | null;
        required?: Array<string> | null;
        [k: string]: unknown;
      }
      name: string;
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      description?: string;
      eager_input_streaming?: boolean | null;
      input_examples?: Array<{ [key: string]: unknown }>;
      strict?: boolean;
    }
  | {
      name: "bash";
      type: "bash_20250124";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      input_examples?: Array<{ [key: string]: unknown }>;
      strict?: boolean;
    }
  | {
      name: "code_execution";
      type: "code_execution_20250522";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      strict?: boolean;
    }
  | {
      name: "code_execution";
      type: "code_execution_20250825";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      strict?: boolean;
  }
  | {
      name: "code_execution";
      type: "code_execution_20260120";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      strict?: boolean;
    }
  | {
      name: "memory";
      type: "memory_20250818";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      input_examples?: Array<{ [key: string]: unknown }>;
      strict?: boolean;
    }
  | {
      name: "str_replace_editor";
      type: "text_editor_20250124";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      input_examples?: Array<{ [key: string]: unknown }>;
      strict?: boolean;
    }
  | {
    name: "str_replace_based_edit_tool";
    type: "text_editor_20250429";
    allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    input_examples?: Array<{ [key: string]: unknown }>;
    strict?: boolean;
    }
  | {
      name: "str_replace_based_edit_tool";
      type: "text_editor_20250728";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      input_examples?: Array<{ [key: string]: unknown }>;
      max_characters?: number | null;
      strict?: boolean;
    }
  | {
      name: "web_search";
      type: "web_search_20250305";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      strict?: boolean;
      allowed_domains?: Array<string> | null;
      blocked_domains?: Array<string> | null;
      max_uses?: number | null;
      user_location?: {
        type: "approximate";
        city?: string | null;
        country?: string | null;
        region?: string | null;
        timezone?: string | null;
      } | null;
    }
  | {
      name: "web_search";
      type: "web_search_20260209";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      strict?: boolean;
      allowed_domains?: Array<string> | null;
      blocked_domains?: Array<string> | null;
      max_uses?: number | null;
      user_location?: {
        type: "approximate";
        city?: string | null;
        country?: string | null;
        region?: string | null;
        timezone?: string | null;
      } | null;
    }
  | {
    name: "web_fetch";
    type: "web_fetch_20250910";
    allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
    cache_control?: CacheControlEphemeral | null;
    defer_loading?: boolean;
    strict?: boolean;
    allowed_domains?: Array<string> | null;
    blocked_domains?: Array<string> | null;
    citations?: { enabled?: boolean } | null;
    max_content_tokens?: number | null;
    max_uses?: number | null;
    }
  | {
      name: "web_fetch";
      type: "web_fetch_20260209";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      strict?: boolean;
      allowed_domains?: Array<string> | null;
      blocked_domains?: Array<string> | null;
      citations?: { enabled?: boolean } | null;
      max_content_tokens?: number | null;
      max_uses?: number | null;
    }
  | {
      name: "tool_search_tool_bm25";
      type: "tool_search_tool_bm25_20251119" | "tool_search_tool_bm25";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      strict?: boolean;
    }
  | {
      name: "tool_search_tool_regex";
      type: "tool_search_tool_regex_20251119" | "tool_search_tool_regex";
      allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
      cache_control?: CacheControlEphemeral | null;
      defer_loading?: boolean;
      strict?: boolean;
    }
```

## Message Create Params

```typescript
export interface MessageCreateParamsBase {
  max_tokens: number;
  messages: MessageParam[]
  model: string;
    system?: string | {
    type: "text";
    text: string;
    cache_control?: CacheControlEphemeral | null;
    citations?: Array<TextCitationParam> | null;
  };
  tools?: ToolUnion[]
  tool_choice?: 
    | { type: "none" }
    | { type: "auto"; disable_parallel_tool_use?: boolean }
    | { type: "any"; disable_parallel_tool_use?: boolean }
    | { type: "tool"; name: string; disable_parallel_tool_use?: boolean }
  metadata?: { user_id?: string | null }
  stop_sequences?: string[]
  temperature?: number;
  top_p?: number;
  top_k?: number;
  anthropic_beta?: string[]
  anthropic_version?: string;
  count_tokens?: boolean;
  thinking?: 
    | { type: "disabled" }
    | { type: "adaptive" }
    | { type: "enabled"; budget_tokens: number }
  citations?: { enabled?: boolean };
  output_config?: {
    effort?: "low" | "medium" | "high" | "max" | null;
    format?: {
      type: "json_schema";
      schema: { [key: string]: unknown };
    } | null;
  }
  cache_control?: CacheControlEphemeral | null;
  container?: string | null;
  inference_geo?: string | null;
  service_tier?: "auto" | "standard_only";
  stream?: boolean;
}
```


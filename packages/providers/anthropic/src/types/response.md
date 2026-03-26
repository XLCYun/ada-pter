# Response

## Content Block

```typescript
type Citation = {
        type: "char_location";
        cited_text: string;
        document_index: number;
        document_title: string | null;
        end_char_index: number;
        file_id: string | null;
        start_char_index: number;
    } | {
        type: "page_location";
        cited_text: string;
        document_index: number;
        document_title: string | null;
        end_page_number: number;
        file_id: string | null;
        start_page_number: number;
    } | {
        type: "content_block_location";
        cited_text: string;
        document_index: number;
        document_title: string | null;
        end_block_index: number;
        file_id: string | null;
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
type TextCitation = Citation
type Caller = {
        type: "direct";
    } | {
        tool_id: string;
        type: "code_execution_20250825";
    } | {
        tool_id: string;
        type: "code_execution_20260120";
    }; // DirectCaller | ServerToolCaller | ServerToolCaller20260120

```

```typescript
type ContentBlock = {
    type: "text";
    text: string;
    citations: null | Citation[];
} | {
    type: "thinking";
    thinking: string;
    signature: string;
} | {
    type: "redacted_thinking";
    data: string;
} | {
    type: "tool_use";
    id: string;
    name: string;
    input: unknown;
    caller: Caller
} | {
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
    caller: Caller;
} | {
    type: "web_search_tool_result";
    tool_use_id: string;
    content: {
        error_code: string;
        type: "web_search_tool_result_error";
    } | ({
        encrypted_content: string;
        page_age: string | null;
        title: string;
        type: "web_search_result";
        url: string;
    }[]);
    caller: Caller;
} | {
    type: "web_fetch_tool_result";
    tool_use_id: string;
    content: {
        error_code: string;
        type: "web_fetch_tool_result_error";
    } | ({
        content: {
            citations: { enabled: boolean } | null;
            source: {
                type: "base64";
                media_type: "application/pdf";
                data: string;
            } | {
                type: "text";
                media_type: "text/plain";
                data: string;
            };
            title: string | null;
            type: "document";
        };
        retrieved_at: string | null;
        type: "web_fetch_result";
        url: string;
    });
    caller: Caller;
} | {
    type: "code_execution_tool_result";
    tool_use_id: string;
    content: {
        error_code: string;
        type: "code_execution_tool_result_error";
    } | {
        content: {
            type: "code_execution_output";
            file_id: string;
        }[];
        return_code: number;
        stderr: string;
        stdout: string;
        type: "code_execution_result";
    } | {
        content: {
            type: "code_execution_output";
            file_id: string;
        }[];
        encrypted_stdout: string;
        return_code: number;
        stderr: string;
        type: "encrypted_code_execution_result";
    };
} | {
    type: "bash_code_execution_tool_result";
    tool_use_id: string;
    content: {
        error_code: BashCodeExecutionToolResultErrorCode;
        type: "bash_code_execution_tool_result_error";
    } | {
        content: {
            type: "bash_code_execution_output";
            file_id: string;
        }[];
        return_code: number;
        stderr: string;
        stdout: string;
        type: "bash_code_execution_result";
    };
} | {
    type: "text_editor_code_execution_tool_result";
    tool_use_id: string;
    content: {
        error_code: string;
        error_message: string | null;
        type: "text_editor_code_execution_tool_result_error";
    } | {
        type: "text_editor_code_execution_view_result";
        content: string;
        file_type: "text" | "image" | "pdf";
        num_lines: number | null;
        start_line: number | null;
        total_lines: number | null;
    } | {
        type: "text_editor_code_execution_create_result";
        is_file_update: boolean;
    } | {
        type: "text_editor_code_execution_str_replace_result";
        lines: string[] | null;
        new_lines: number | null;
        new_start: number | null;
        old_lines: number | null;
        old_start: number | null;
    };
} | {
    type: "tool_search_tool_result";
    tool_use_id: string;
    content: {
        error_code: string;
        error_message: string | null;
        type: "tool_search_tool_result_error";
    } | {
        tool_references: {
            type: "tool_reference";
            tool_name: string;
            cache_control?: CacheControlEphemeral | null;
        }[];
        type: "tool_search_tool_search_result";
    };
} | {
    type: "container_upload";
    file_id: string;
}
```

## Response Type

```typescript
 interface Message {
  id: string;
  content: ContentBlock[];
  model: string;
  role: "assistant";
  container: {
      id: string;
      expires_at: string;
  } | null;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | "pause_turn" | "refusal" | null;
  stop_sequence: string | null;
  type: "message";
  usage: usage: {
        cache_creation: null | {
            ephemeral_1h_input_tokens: number
            ephemeral_5m_input_tokens: number
        }
        cache_creation_input_tokens: number | null
        cache_read_input_tokens: number | null
        inference_geo: string | null
        input_tokens: number
        output_tokens: number
        server_tool_use: null | {
            web_fetch_requests: number
            web_search_requests: number
        }
        service_tier: "standard" | "priority" | "batch" | null
    }
}
```

## Stream Chunk

### Message Start Event

```typescript
{
  type: "message_start"
  message: {
    id: string
    type: "message"
    role: "assistant"
    content: ContentBlock[]
    model: string
    stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | "pause_turn" | "refusal"
    stop_sequence: string | null
    usage: {
        cache_creation: null | {
            ephemeral_1h_input_tokens: number
            ephemeral_5m_input_tokens: number
        }
        cache_creation_input_tokens: number | null
        cache_read_input_tokens: number | null
        inference_geo: string | null
        input_tokens: number
        output_tokens: number
        server_tool_use: null | {
            web_fetch_requests: number
            web_search_requests: number
        }
        service_tier: "standard" | "priority" | "batch" | null
    }
    container: null | {
        id: string
        expires_at: string
    }
  }
}
```

### Message Delta Event

```typescript
{
    type: "message_delta";
    delta: {
        container: {
            id: string;
            expires_at: string;
        } | null;
        stop_reason: StopReason | null;
        stop_sequence: string | null;
    };
    usage: {
        input_tokens: number | null;
        output_tokens: number;
        cache_creation_input_tokens: number | null;
        cache_read_input_tokens: number | null;
        server_tool_use: {
            web_fetch_requests: number;
            web_search_requests: number;
        } | null;
    };
}
```

### Message Stop Event

```typescript
{
  type: "message_stop";
}
```

### Content Block Start Event

```typescript
{
    type: "content_block_start";
    index: number;
    content_block: ContentBlock;
}
```

### Content Block Delta Event

```typescript
{
    type: "content_block_delta";
    index: number;
    delta: {
        type: "text_delta";
        text: string;
    } | {
        type: "input_json_delta";
        partial_json: string;
    } | {
        type: "citations_delta";
        citation: Citation;
    } | {
        type: "thinking_delta";
        thinking: string;
    } | {
        type: "signature_delta";
        signature: string;
    };
}
```

### Content Block Stop Event

```typescript
{
    type: "content_block_stop";
    index: number;
}
```

### Error Event

```typescript
{
    type: "error";
    error: {
        type: string;
        message: string;
    }
}
```


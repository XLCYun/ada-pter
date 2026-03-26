export type APIPromise<T> = Promise<T>;

export interface Stream<T = unknown> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

export type HTTPMethod = "get" | "post" | "put" | "patch" | "delete";

export type MergedRequestInit = RequestInit & Partial<Record<"body" | "headers" | "method" | "signal", never>>;

export interface RequestOptions {
  method?: HTTPMethod;
  path?: string;
  query?: object | undefined | null;
  body?: unknown;
  headers?: HeadersLike;
  maxRetries?: number;
  stream?: boolean | undefined;
  timeout?: number;
  /** Compatible with SDK's RequestInit (use RequestInit for cross-assignability). */
  fetchOptions?: RequestInit | MergedRequestInit;
  signal?: AbortSignal | undefined | null;
  idempotencyKey?: string;
  defaultBaseURL?: string | undefined;
}

export type HeadersLike = Headers | Record<string, string | null | undefined> | Array<[string, string]>;

export interface AnthropicError {
  message: string;
  type?: string;
  param?: string;
  code?: string;
}

export type AnthropicErrorType = AnthropicError;

export interface MessagesAPI {
  create(body: MessageCreateParamsNonStreaming, options?: RequestOptions): APIPromise<Message>;
  create(body: MessageCreateParamsStreaming, options?: RequestOptions): APIPromise<Stream<RawMessageStreamEvent>>;
  create(body: MessageCreateParamsBase, options?: RequestOptions): APIPromise<Stream<RawMessageStreamEvent> | Message>;
}

export namespace MessageDelta {
  export interface Delta {
    container: Container | null;
    stop_reason: StopReason | null;
    stop_sequence: string | null;
  }
}

export type Delta = MessageDelta.Delta;

// Message types
export interface Message {
  id: string;
  container: Container | null;
  content: Array<ContentBlock>;
  model: Model;
  role: "assistant";
  stop_reason: StopReason | null;
  stop_sequence: string | null;
  type: "message";
  usage: Usage;
}

export interface Container {
  id: string;
  expires_at: string;
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | RedactedThinkingBlock
  | ToolUseBlock
  | ServerToolUseBlock
  | WebSearchToolResultBlock
  | WebFetchToolResultBlock
  | CodeExecutionToolResultBlock
  | BashCodeExecutionToolResultBlock
  | TextEditorCodeExecutionToolResultBlock
  | ToolSearchToolResultBlock
  | ContainerUploadBlock;

export type TextCitation =
  | CitationCharLocation
  | CitationPageLocation
  | CitationContentBlockLocation
  | CitationsWebSearchResultLocation
  | CitationsSearchResultLocation;

/** Param variants (no file_id) for request payloads. */
export type TextCitationParam =
  | CitationCharLocationParam
  | CitationPageLocationParam
  | CitationContentBlockLocationParam
  | CitationWebSearchResultLocationParam
  | CitationSearchResultLocationParam;

export interface CitationCharLocationParam {
  type: "char_location";
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_char_index: number;
  start_char_index: number;
}

export interface CitationPageLocationParam {
  type: "page_location";
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_page_number: number;
  start_page_number: number;
}

export interface CitationContentBlockLocationParam {
  type: "content_block_location";
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_block_index: number;
  start_block_index: number;
}

export interface CitationWebSearchResultLocationParam {
  type: "web_search_result_location";
  cited_text: string;
  encrypted_index: string;
  title: string | null;
  url: string;
}

export interface CitationSearchResultLocationParam {
  type: "search_result_location";
  cited_text: string;
  end_block_index: number;
  search_result_index: number;
  source: string;
  start_block_index: number;
  title: string | null;
}

// Alias for compatibility
export type Citation = TextCitation;

export interface TextBlock {
  type: "text";
  text: string;
  citations: Array<TextCitation> | null;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature: string;
}

export interface RedactedThinkingBlock {
  type: "redacted_thinking";
  data: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
  caller: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export interface ServerToolUseBlock {
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
  caller: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export interface WebSearchToolResultBlock {
  type: "web_search_tool_result";
  tool_use_id: string;
  content: WebSearchToolResultBlockContent;
  caller: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export type WebFetchToolResultBlockContent = WebFetchToolResultErrorBlock | WebFetchBlock;

export interface WebFetchToolResultBlock {
  type: "web_fetch_tool_result";
  tool_use_id: string;
  content: WebFetchToolResultBlockContent;
  caller: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export interface CodeExecutionToolResultBlock {
  type: "code_execution_tool_result";
  tool_use_id: string;
  content: CodeExecutionToolResultBlockContent;
}

export interface BashCodeExecutionToolResultBlock {
  type: "bash_code_execution_tool_result";
  tool_use_id: string;
  content: BashCodeExecutionToolResultError | BashCodeExecutionResultBlock;
}

export interface TextEditorCodeExecutionToolResultBlock {
  type: "text_editor_code_execution_tool_result";
  tool_use_id: string;
  content: TextEditorCodeExecutionToolResultBlockContent;
}

export interface ToolSearchToolResultBlock {
  type: "tool_search_tool_result";
  tool_use_id: string;
  content: ToolSearchToolResultBlockContent;
}

export type ToolSearchToolResultBlockContent = ToolSearchToolResultError | ToolSearchToolSearchResultBlock;

export interface ContainerUploadBlock {
  type: "container_upload";
  file_id: string;
}

export type WebSearchToolResultBlockContent = WebSearchToolResultError | Array<WebSearchResultBlock>;

export interface WebSearchToolResultError {
  error_code: WebSearchToolResultErrorCode;
  type: "web_search_tool_result_error";
}

export interface WebSearchResultBlock {
  encrypted_content: string;
  page_age: string | null;
  title: string;
  type: "web_search_result";
  url: string;
}

/** Alias for web_search success (single result block). */
export type WebSearchToolResultSuccess = WebSearchResultBlock;

export interface CitationsConfig {
  enabled: boolean;
}

export interface DocumentBlock {
  citations: CitationsConfig | null;
  source: Base64PDFSource | PlainTextSource;
  title: string | null;
  type: "document";
}

export interface WebFetchBlock {
  content: DocumentBlock;
  retrieved_at: string | null;
  type: "web_fetch_result";
  url: string;
}

export interface WebFetchToolResultErrorBlock {
  error_code: WebFetchToolResultErrorCode;
  type: "web_fetch_tool_result_error";
}

export interface WebFetchToolResultError {
  error_code: WebFetchToolResultErrorCode;
  type: "web_fetch_tool_result_error";
}

export interface WebFetchToolResultBlockParam {
  content: WebFetchToolResultErrorBlockParam | WebFetchBlockParam;
  tool_use_id: string;
  type: "web_fetch_tool_result";
  cache_control?: CacheControlEphemeral | null;
  caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export interface WebFetchBlockParam {
  content: DocumentBlockParam;
  type: "web_fetch_result";
  url: string;
  retrieved_at?: string | null;
}

/** Alias for web_fetch success content. */
export type WebFetchToolResultSuccess = WebFetchBlock;

export type CodeExecutionToolResultBlockContent =
  | CodeExecutionToolResultError
  | CodeExecutionResultBlock
  | EncryptedCodeExecutionResultBlock;

export interface CodeExecutionToolResultError {
  error_code: CodeExecutionToolResultErrorCode;
  type: "code_execution_tool_result_error";
}

export interface CodeExecutionResultBlock {
  content: Array<CodeExecutionOutputBlock>;
  return_code: number;
  stderr: string;
  stdout: string;
  type: "code_execution_result";
}

export interface CodeExecutionOutputBlock {
  type: "code_execution_output";
  file_id: string;
}

/** Alias for SDK compatibility (SDK uses CodeExecutionOutputBlock for both). */
export type TextEditorCodeExecutionOutputBlock = CodeExecutionOutputBlock;

export interface BashCodeExecutionToolResultError {
  error_code: BashCodeExecutionToolResultErrorCode;
  type: "bash_code_execution_tool_result_error";
}

export interface BashCodeExecutionResultBlock {
  content: Array<BashCodeExecutionOutputBlock>;
  return_code: number;
  stderr: string;
  stdout: string;
  type: "bash_code_execution_result";
}

export interface BashCodeExecutionOutputBlock {
  type: "bash_code_execution_output";
  file_id: string;
}

export type TextEditorCodeExecutionToolResultBlockContent =
  | TextEditorCodeExecutionToolResultError
  | TextEditorCodeExecutionViewResultBlock
  | TextEditorCodeExecutionCreateResultBlock
  | TextEditorCodeExecutionStrReplaceResultBlock;

export interface TextEditorCodeExecutionToolResultError {
  error_code: TextEditorCodeExecutionToolResultErrorCode;
  error_message: string | null;
  type: "text_editor_code_execution_tool_result_error";
}

export interface TextEditorCodeExecutionViewResultBlock {
  type: "text_editor_code_execution_view_result";
  content: string;
  file_type: "text" | "image" | "pdf";
  num_lines: number | null;
  start_line: number | null;
  total_lines: number | null;
}

export interface TextEditorCodeExecutionCreateResultBlock {
  type: "text_editor_code_execution_create_result";
  is_file_update: boolean;
}

export interface TextEditorCodeExecutionStrReplaceResultBlock {
  type: "text_editor_code_execution_str_replace_result";
  lines: Array<string> | null;
  new_lines: number | null;
  new_start: number | null;
  old_lines: number | null;
  old_start: number | null;
}

/** Alias: result block content (view/create/str_replace). */
export type TextEditorCodeExecutionResultBlock =
  | TextEditorCodeExecutionViewResultBlock
  | TextEditorCodeExecutionCreateResultBlock
  | TextEditorCodeExecutionStrReplaceResultBlock;

export interface ToolSearchToolResultError {
  error_code: ToolSearchToolResultErrorCode;
  error_message: string | null;
  type: "tool_search_tool_result_error";
}

export interface ToolSearchToolSearchResultBlock {
  tool_references: Array<ToolReferenceBlockParam>;
  type: "tool_search_tool_search_result";
}

/** Alias for tool search success result. */
export type ToolSearchResult = ToolSearchToolSearchResultBlock;

/** Alias for tool search success result. */
export type ToolSearchToolResultSuccess = ToolSearchToolSearchResultBlock;

export type Model =
  | "claude-opus-4-6"
  | "claude-sonnet-4-6"
  | "claude-opus-4-5-20251101"
  | "claude-opus-4-5"
  | "claude-3-7-sonnet-latest"
  | "claude-3-7-sonnet-20250219"
  | "claude-3-5-haiku-latest"
  | "claude-3-5-haiku-20241022"
  | "claude-haiku-4-5"
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-20250514"
  | "claude-sonnet-4-0"
  | "claude-4-sonnet-20250514"
  | "claude-sonnet-4-5"
  | "claude-sonnet-4-5-20250929"
  | "claude-opus-4-0"
  | "claude-opus-4-20250514"
  | "claude-4-opus-20250514"
  | "claude-opus-4-1-20250805"
  | "claude-3-opus-latest"
  | "claude-3-opus-20240229"
  | "claude-3-haiku-20240307"
  | (string & {});

export type StopReason = "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | "pause_turn" | "refusal";

export interface Usage {
  cache_creation: CacheCreation | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  inference_geo: string | null;
  input_tokens: number;
  output_tokens: number;
  server_tool_use: ServerToolUsage | null;
  service_tier: "standard" | "priority" | "batch" | null;
}

// Parameter types
export interface MessageCreateParamsBase {
  max_tokens: number;
  messages: Array<MessageParam>;
  model: Model;
  system?: string | Array<SystemMessageParam>;
  tools?: Array<ToolUnion>;
  tool_choice?: ToolChoice;
  metadata?: Metadata;
  stop_sequences?: Array<string>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  anthropic_beta?: Array<string>;
  anthropic_version?: string;
  count_tokens?: boolean;
  thinking?: ThinkingConfigParam;
  citations?: CitationsConfigParam;
  output_config?: OutputConfig;
  cache_control?: CacheControlEphemeral | null;
  container?: string | null;
  inference_geo?: string | null;
  service_tier?: "auto" | "standard_only";
  stream?: boolean;
}

export interface MessageParam {
  content: string | Array<ContentBlockParam>;
  role: "user" | "assistant";
}

export type ContentBlockParam =
  | TextBlockParam
  | ImageBlockParam
  | DocumentBlockParam
  | SearchResultBlockParam
  | ThinkingBlockParam
  | RedactedThinkingBlockParam
  | ToolUseBlockParam
  | ToolResultBlockParam
  | ServerToolUseBlockParam
  | WebSearchToolResultBlockParam
  | WebFetchToolResultBlockParam
  | CodeExecutionToolResultBlockParam
  | BashCodeExecutionToolResultBlockParam
  | TextEditorCodeExecutionToolResultBlockParam
  | ToolSearchToolResultBlockParam
  | ContainerUploadBlockParam;

export interface TextBlockParam {
  type: "text";
  text: string;
  cache_control?: CacheControlEphemeral | null;
  citations?: Array<TextCitationParam> | null;
}

export interface ImageBlockParam {
  type: "image";
  source: Base64ImageSource | URLImageSource;
  cache_control?: CacheControlEphemeral | null;
}

export interface Base64ImageSource {
  type: "base64";
  media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
}

export interface URLImageSource {
  type: "url";
  url: string;
}

export interface DocumentBlockParam {
  type: "document";
  source: Base64PDFSource | PlainTextSource | ContentBlockSource | URLPDFSource;
  cache_control?: CacheControlEphemeral | null;
  citations?: CitationsConfigParam | null;
  context?: string | null;
  title?: string | null;
}

export interface Base64PDFSource {
  type: "base64";
  media_type: "application/pdf";
  data: string;
}

export interface PlainTextSource {
  type: "text";
  media_type: "text/plain";
  data: string;
}

export interface ContentBlockSource {
  type: "content";
  content: string | Array<ContentBlockSourceContent>;
}

export type ContentBlockSourceContent = TextBlockParam | ImageBlockParam;

export interface URLPDFSource {
  type: "url";
  url: string;
}

export interface SearchResultBlockParam {
  type: "search_result";
  content: Array<TextBlockParam>;
  source: string;
  title: string;
  cache_control?: CacheControlEphemeral | null;
  citations?: CitationsConfigParam;
}

/** Alias for SDK compatibility (tool search result block). */
export type SearchResult = ToolSearchToolSearchResultBlock;

export interface ThinkingBlockParam {
  type: "thinking";
  signature: string;
  thinking: string;
}

export interface RedactedThinkingBlockParam {
  type: "redacted_thinking";
  data: string;
}

export interface ToolUseBlockParam {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
  cache_control?: CacheControlEphemeral | null;
  caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export interface ToolResultBlockParam {
  type: "tool_result";
  tool_use_id: string;
  content?: string | Array<ToolResultBlockParamContent>;
  is_error?: boolean;
  cache_control?: CacheControlEphemeral | null;
}

export type ToolResultBlockParamContent =
  | TextBlockParam
  | ImageBlockParam
  | DocumentBlockParam
  | SearchResultBlockParam
  | ToolReferenceBlockParam;

export interface ToolReferenceBlockParam {
  type: "tool_reference";
  tool_name: string;
  cache_control?: CacheControlEphemeral | null;
}

export interface ServerToolUseBlockParam {
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
  caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

// Missing caller types
export interface DirectCaller {
  type: "direct";
}

export interface ServerToolCaller {
  tool_id: string;
  type: "code_execution_20250825";
}

export interface ServerToolCaller20260120 {
  tool_id: string;
  type: "code_execution_20260120";
}

export type WebSearchToolResultErrorCode =
  | "invalid_tool_input"
  | "unavailable"
  | "max_uses_exceeded"
  | "too_many_requests"
  | "query_too_long"
  | "request_too_large";

export type WebFetchToolResultErrorCode =
  | "invalid_tool_input"
  | "url_too_long"
  | "url_not_allowed"
  | "url_not_accessible"
  | "unsupported_content_type"
  | "too_many_requests"
  | "max_uses_exceeded"
  | "unavailable";

export interface WebSearchToolResultBlockParam {
  type: "web_search_tool_result";
  tool_use_id: string;
  content: WebSearchToolResultBlockParamContent;
  cache_control?: CacheControlEphemeral | null;
  caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export type WebSearchToolResultBlockParamContent = Array<WebSearchResultBlockParam> | WebSearchToolRequestError;

export interface WebSearchToolRequestError {
  error_code: WebSearchToolResultErrorCode;
  type: "web_search_tool_result_error";
}

export interface WebSearchResultBlockParam {
  type: "web_search_result";
  encrypted_content: string;
  title: string;
  url: string;
  page_age?: string | null;
}

export interface WebFetchToolResultBlockParam {
  type: "web_fetch_tool_result";
  tool_use_id: string;
  content: WebFetchToolResultErrorBlockParam | WebFetchBlockParam;
  cache_control?: CacheControlEphemeral | null;
  caller?: DirectCaller | ServerToolCaller | ServerToolCaller20260120;
}

export interface WebFetchToolResultErrorBlockParam {
  error_code: WebFetchToolResultErrorCode;
  type: "web_fetch_tool_result_error";
}

export interface WebFetchBlockParam {
  content: DocumentBlockParam;
  type: "web_fetch_result";
  url: string;
  retrieved_at?: string | null;
}

export type WebFetchToolResultBlockParamContent = WebFetchToolResultErrorBlockParam | WebFetchBlockParam;

export interface WebFetchToolResultErrorParam {
  error_code: WebFetchToolResultErrorCode;
  type: "web_fetch_tool_result_error";
}

export interface WebFetchToolResultErrorBlockParam {
  error_code: WebFetchToolResultErrorCode;
  type: "web_fetch_tool_result_error";
}

/** Alias for SDK compatibility (WebFetchBlockParam). */
export type WebFetchToolResultSuccessParam = WebFetchBlockParam;

export interface CodeExecutionToolResultBlockParam {
  type: "code_execution_tool_result";
  tool_use_id: string;
  content: CodeExecutionToolResultBlockParamContent;
  cache_control?: CacheControlEphemeral | null;
}

export type CodeExecutionToolResultBlockParamContent =
  | CodeExecutionToolResultErrorParam
  | CodeExecutionResultBlockParam
  | EncryptedCodeExecutionResultBlockParam;

export type CodeExecutionToolResultErrorCode =
  | "invalid_tool_input"
  | "unavailable"
  | "too_many_requests"
  | "execution_time_exceeded";

export type BashCodeExecutionToolResultErrorCode =
  | "invalid_tool_input"
  | "unavailable"
  | "too_many_requests"
  | "execution_time_exceeded"
  | "output_file_too_large";

export type TextEditorCodeExecutionToolResultErrorCode =
  | "invalid_tool_input"
  | "unavailable"
  | "too_many_requests"
  | "execution_time_exceeded"
  | "file_not_found";

export interface CodeExecutionToolResultErrorParam {
  error_code: CodeExecutionToolResultErrorCode;
  type: "code_execution_tool_result_error";
}

export interface CodeExecutionResultBlockParam {
  content: Array<CodeExecutionOutputBlockParam>;
  return_code: number;
  stderr: string;
  stdout: string;
  type: "code_execution_result";
}

export interface EncryptedCodeExecutionResultBlock {
  content: Array<CodeExecutionOutputBlock>;
  encrypted_stdout: string;
  return_code: number;
  stderr: string;
  type: "encrypted_code_execution_result";
}

export interface CodeExecutionOutputBlockParam {
  type: "code_execution_output";
  file_id: string;
}

/** Alias for SDK compatibility. */
export type TextEditorCodeExecutionOutputBlockParam = CodeExecutionOutputBlockParam;

export interface BashCodeExecutionToolResultBlockParam {
  type: "bash_code_execution_tool_result";
  tool_use_id: string;
  content: BashCodeExecutionToolResultErrorParam | BashCodeExecutionResultBlockParam;
  cache_control?: CacheControlEphemeral | null;
}

export interface BashCodeExecutionToolResultErrorParam {
  error_code: BashCodeExecutionToolResultErrorCode;
  type: "bash_code_execution_tool_result_error";
}

export interface BashCodeExecutionResultBlockParam {
  content: Array<BashCodeExecutionOutputBlockParam>;
  return_code: number;
  stderr: string;
  stdout: string;
  type: "bash_code_execution_result";
}

export interface BashCodeExecutionOutputBlockParam {
  type: "bash_code_execution_output";
  file_id: string;
}

export interface EncryptedCodeExecutionResultBlockParam {
  content: Array<CodeExecutionOutputBlockParam>;
  encrypted_stdout: string;
  return_code: number;
  stderr: string;
  type: "encrypted_code_execution_result";
}

export interface TextEditorCodeExecutionToolResultBlockParam {
  type: "text_editor_code_execution_tool_result";
  tool_use_id: string;
  content: TextEditorCodeExecutionToolResultBlockParamContent;
  cache_control?: CacheControlEphemeral | null;
}

export type TextEditorCodeExecutionToolResultBlockParamContent =
  | TextEditorCodeExecutionToolResultErrorParam
  | TextEditorCodeExecutionViewResultBlockParam
  | TextEditorCodeExecutionCreateResultBlockParam
  | TextEditorCodeExecutionStrReplaceResultBlockParam;

/** Alias: result block param content (view/create/str_replace). */
export type TextEditorCodeExecutionResultBlockParam =
  | TextEditorCodeExecutionViewResultBlockParam
  | TextEditorCodeExecutionCreateResultBlockParam
  | TextEditorCodeExecutionStrReplaceResultBlockParam;

export interface TextEditorCodeExecutionToolResultErrorParam {
  error_code: TextEditorCodeExecutionToolResultErrorCode;
  type: "text_editor_code_execution_tool_result_error";
  error_message?: string | null;
}

export interface TextEditorCodeExecutionViewResultBlockParam {
  type: "text_editor_code_execution_view_result";
  content: string;
  file_type: "text" | "image" | "pdf";
  num_lines?: number | null;
  start_line?: number | null;
  total_lines?: number | null;
}

export interface TextEditorCodeExecutionCreateResultBlockParam {
  type: "text_editor_code_execution_create_result";
  is_file_update: boolean;
}

export interface TextEditorCodeExecutionStrReplaceResultBlockParam {
  type: "text_editor_code_execution_str_replace_result";
  lines?: Array<string> | null;
  new_lines?: number | null;
  new_start?: number | null;
  old_lines?: number | null;
  old_start?: number | null;
}

export interface ToolSearchToolResultBlockParam {
  type: "tool_search_tool_result";
  tool_use_id: string;
  content: ToolSearchToolResultBlockParamContent;
  cache_control?: CacheControlEphemeral | null;
}

export type ToolSearchToolResultBlockParamContent =
  | ToolSearchToolResultErrorParam
  | ToolSearchToolSearchResultBlockParam;

export type ToolSearchToolResultErrorCode =
  | "invalid_tool_input"
  | "unavailable"
  | "too_many_requests"
  | "execution_time_exceeded";

export interface ToolSearchToolResultErrorParam {
  error_code: ToolSearchToolResultErrorCode;
  type: "tool_search_tool_result_error";
}

export interface ToolReferenceBlockParam {
  type: "tool_reference";
  tool_name: string;
}

export interface ToolSearchToolSearchResultBlockParam {
  type: "tool_search_tool_search_result";
  tool_references: Array<ToolReferenceBlockParam>;
}

export interface ContainerUploadBlockParam {
  type: "container_upload";
  file_id: string;
  cache_control?: CacheControlEphemeral | null;
}

/** System message block; matches TextBlockParam for SDK compatibility. */
export type SystemMessageParam = TextBlockParam;

export interface Tool {
  input_schema: Tool.InputSchema;
  name: string;
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  description?: string;
  eager_input_streaming?: boolean | null;
  input_examples?: Array<{ [key: string]: unknown }>;
  strict?: boolean;
  type?: "custom" | null;
}

export namespace Tool {
  export interface InputSchema {
    type: "object";
    properties?: unknown | null;
    required?: Array<string> | null;
    [k: string]: unknown;
  }
}

// Built-in tool types
export interface ToolBash20250124 {
  name: "bash";
  type: "bash_20250124";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  input_examples?: Array<{ [key: string]: unknown }>;
  strict?: boolean;
}

export interface CodeExecutionTool20250522 {
  name: "code_execution";
  type: "code_execution_20250522";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  strict?: boolean;
}

export interface CodeExecutionTool20250825 {
  name: "code_execution";
  type: "code_execution_20250825";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  strict?: boolean;
}

export interface CodeExecutionTool20260120 {
  name: "code_execution";
  type: "code_execution_20260120";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  strict?: boolean;
}

export interface MemoryTool20250818 {
  name: "memory";
  type: "memory_20250818";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  input_examples?: Array<{ [key: string]: unknown }>;
  strict?: boolean;
}

export interface ToolTextEditor20250124 {
  name: "str_replace_editor";
  type: "text_editor_20250124";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  input_examples?: Array<{ [key: string]: unknown }>;
  strict?: boolean;
}

export interface ToolTextEditor20250429 {
  name: "str_replace_based_edit_tool";
  type: "text_editor_20250429";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  input_examples?: Array<{ [key: string]: unknown }>;
  strict?: boolean;
}

export interface ToolTextEditor20250728 {
  name: "str_replace_based_edit_tool";
  type: "text_editor_20250728";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  input_examples?: Array<{ [key: string]: unknown }>;
  max_characters?: number | null;
  strict?: boolean;
}

export interface UserLocation {
  type: "approximate";
  city?: string | null;
  country?: string | null;
  region?: string | null;
  timezone?: string | null;
}

export interface WebSearchTool20250305 {
  name: "web_search";
  type: "web_search_20250305";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  strict?: boolean;
  allowed_domains?: Array<string> | null;
  blocked_domains?: Array<string> | null;
  max_uses?: number | null;
  user_location?: UserLocation | null;
}

export interface WebFetchTool20250910 {
  name: "web_fetch";
  type: "web_fetch_20250910";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  strict?: boolean;
  allowed_domains?: Array<string> | null;
  blocked_domains?: Array<string> | null;
  citations?: CitationsConfigParam | null;
  max_content_tokens?: number | null;
  max_uses?: number | null;
}

export interface WebSearchTool20260209 {
  name: "web_search";
  type: "web_search_20260209";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  strict?: boolean;
  allowed_domains?: Array<string> | null;
  blocked_domains?: Array<string> | null;
  max_uses?: number | null;
  user_location?: UserLocation | null;
}

export interface WebFetchTool20260209 {
  name: "web_fetch";
  type: "web_fetch_20260209";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  strict?: boolean;
  allowed_domains?: Array<string> | null;
  blocked_domains?: Array<string> | null;
  citations?: CitationsConfigParam | null;
  max_content_tokens?: number | null;
  max_uses?: number | null;
}

export interface ToolSearchToolBm25_20251119 {
  name: "tool_search_tool_bm25";
  type: "tool_search_tool_bm25_20251119" | "tool_search_tool_bm25";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  strict?: boolean;
}

export interface ToolSearchToolRegex20251119 {
  name: "tool_search_tool_regex";
  type: "tool_search_tool_regex_20251119" | "tool_search_tool_regex";
  allowed_callers?: Array<"direct" | "code_execution_20250825" | "code_execution_20260120">;
  cache_control?: CacheControlEphemeral | null;
  defer_loading?: boolean;
  strict?: boolean;
}

export type ToolUnion =
  | Tool
  | ToolBash20250124
  | CodeExecutionTool20250522
  | CodeExecutionTool20250825
  | CodeExecutionTool20260120
  | MemoryTool20250818
  | ToolTextEditor20250124
  | ToolTextEditor20250429
  | ToolTextEditor20250728
  | WebSearchTool20250305
  | WebFetchTool20250910
  | WebSearchTool20260209
  | WebFetchTool20260209
  | ToolSearchToolBm25_20251119
  | ToolSearchToolRegex20251119;

export type ToolChoice = ToolChoiceAuto | ToolChoiceAny | ToolChoiceTool | ToolChoiceNone;

export interface ToolChoiceAuto {
  type: "auto";
  disable_parallel_tool_use?: boolean;
}

export interface ToolChoiceAny {
  type: "any";
  disable_parallel_tool_use?: boolean;
}

export interface ToolChoiceNone {
  type: "none";
}

export interface ToolChoiceTool {
  type: "tool";
  name: string;
  disable_parallel_tool_use?: boolean;
}

export interface Metadata {
  user_id?: string | null;
}

export interface ThinkingConfigEnabled {
  type: "enabled";
  budget_tokens: number;
}

export interface ThinkingConfigDisabled {
  type: "disabled";
}

export interface ThinkingConfigAdaptive {
  type: "adaptive";
}

export type ThinkingConfigParam = ThinkingConfigEnabled | ThinkingConfigDisabled | ThinkingConfigAdaptive;

export interface CacheControlEphemeral {
  type: "ephemeral";
  ttl?: "5m" | "1h";
}

export interface CacheCreation {
  ephemeral_1h_input_tokens: number;
  ephemeral_5m_input_tokens: number;
}

export interface CitationsConfigParam {
  enabled?: boolean;
}

export interface OutputConfig {
  effort?: "low" | "medium" | "high" | "max" | null;
  format?: JSONOutputFormat | null;
}

export interface JSONOutputFormat {
  type: "json_schema";
  schema: { [key: string]: unknown };
}

export interface MessageCreateParamsNonStreaming extends MessageCreateParamsBase {
  stream?: false;
}

export interface MessageCreateParamsStreaming extends MessageCreateParamsBase {
  stream: true;
}

// Stream event types
export type RawMessageStreamEvent =
  | RawMessageStartEvent
  | RawMessageDeltaEvent
  | RawMessageStopEvent
  | RawContentBlockStartEvent
  | RawContentBlockDeltaEvent
  | RawContentBlockStopEvent
  | RawErrorEvent;

export interface RawMessageStartEvent {
  type: "message_start";
  message: RawMessageStartEvent.Message;
}

export namespace RawMessageStartEvent {
  export interface Message {
    id: string;
    type: "message";
    role: "assistant";
    content: Array<RawContentBlockStartEvent.ContentBlock>;
    model: Model;
    stop_reason: StopReason | null;
    stop_sequence: string | null;
    usage: Usage;
    container: Container | null;
  }
}

export interface RawMessageDeltaEvent {
  type: "message_delta";
  delta: RawMessageDeltaEvent.Delta;
  usage: MessageDeltaUsage;
}

export namespace RawMessageDeltaEvent {
  export interface Delta {
    container: Container | null;
    stop_reason: StopReason | null;
    stop_sequence: string | null;
  }
}

export interface MessageDeltaUsage {
  input_tokens: number | null;
  output_tokens: number;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  server_tool_use: ServerToolUsage | null;
}

export interface ServerToolUsage {
  web_fetch_requests: number;
  web_search_requests: number;
}

export interface RawMessageStopEvent {
  type: "message_stop";
}

export interface RawContentBlockStartEvent {
  type: "content_block_start";
  index: number;
  content_block: RawContentBlockStartEvent.ContentBlock;
}

export namespace RawContentBlockStartEvent {
  export type ContentBlock =
    | TextBlock
    | ThinkingBlock
    | RedactedThinkingBlock
    | ToolUseBlock
    | ServerToolUseBlock
    | WebSearchToolResultBlock
    | WebFetchToolResultBlock
    | CodeExecutionToolResultBlock
    | BashCodeExecutionToolResultBlock
    | TextEditorCodeExecutionToolResultBlock
    | ToolSearchToolResultBlock
    | ContainerUploadBlock;
}

export interface RawContentBlockDeltaEvent {
  type: "content_block_delta";
  index: number;
  delta: RawContentBlockDelta;
}

export type RawContentBlockDelta = TextDelta | InputJSONDelta | CitationsDelta | ThinkingDelta | SignatureDelta;

export interface TextDelta {
  type: "text_delta";
  text: string;
}

export interface InputJSONDelta {
  type: "input_json_delta";
  partial_json: string;
}

export interface CitationsDelta {
  type: "citations_delta";
  citation: CitationsDelta.Citation;
}

export namespace CitationsDelta {
  export type Citation =
    | CitationCharLocation
    | CitationPageLocation
    | CitationContentBlockLocation
    | CitationsWebSearchResultLocation
    | CitationsSearchResultLocation;
}

export interface CitationCharLocation {
  type: "char_location";
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_char_index: number;
  file_id: string | null;
  start_char_index: number;
}

export interface CitationPageLocation {
  type: "page_location";
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_page_number: number;
  file_id: string | null;
  start_page_number: number;
}

export interface CitationContentBlockLocation {
  type: "content_block_location";
  cited_text: string;
  document_index: number;
  document_title: string | null;
  end_block_index: number;
  file_id: string | null;
  start_block_index: number;
}

export interface CitationsWebSearchResultLocation {
  type: "web_search_result_location";
  cited_text: string;
  encrypted_index: string;
  title: string | null;
  url: string;
}

export interface CitationsSearchResultLocation {
  type: "search_result_location";
  cited_text: string;
  end_block_index: number;
  search_result_index: number;
  source: string;
  start_block_index: number;
  title: string | null;
}

export interface ThinkingDelta {
  type: "thinking_delta";
  thinking: string;
}

export interface SignatureDelta {
  type: "signature_delta";
  signature: string;
}

export interface RawContentBlockStopEvent {
  type: "content_block_stop";
  index: number;
}

export interface RawErrorEvent {
  type: "error";
  error: RawErrorEvent.RawErrorEventError;
}

export namespace RawErrorEvent {
  export interface RawErrorEventError {
    type: string;
    message: string;
  }
}

export interface MessagesAPI {
  create(body: MessageCreateParamsNonStreaming, options?: RequestOptions): APIPromise<Message>;
  create(
    body: MessageCreateParamsStreaming,
    options?: RequestOptions,
  ): APIPromise<AsyncIterator<RawMessageStreamEvent>>;
  create(
    body: MessageCreateParamsBase,
    options?: RequestOptions,
  ): APIPromise<Message | AsyncIterator<RawMessageStreamEvent>>;
}

// Re-export nested types for compatibility
export type Error = RawErrorEvent.RawErrorEventError;
export type RawErrorEventError = RawErrorEvent.RawErrorEventError;
export type InputSchema = Tool.InputSchema;

// Additional compatibility aliases for type-check-all.ts
export type BashCodeExecutionToolResultBlockContent = BashCodeExecutionToolResultError | BashCodeExecutionResultBlock;
export type BashCodeExecutionToolResultBlockParamContent =
  | BashCodeExecutionToolResultErrorParam
  | BashCodeExecutionResultBlockParam;
export type WebSearchResult = WebSearchResultBlock;

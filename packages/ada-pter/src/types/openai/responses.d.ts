// OpenAI Responses API Type Definitions

// ---------------------------------------
// Shared Types
// ---------------------------------------
export namespace Shared {
  export type Metadata = { [key: string]: string };
  export type ResponsesModel = string;

  export interface Reasoning {
    effort?: ReasoningEffort | null;
    generate_summary?: "auto" | "concise" | "detailed" | null;
    summary?: "auto" | "concise" | "detailed" | null;
  }

  export type ReasoningEffort =
    | "none"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | null;

  export interface ResponseFormatText {
    type: "text";
  }

  export interface ResponseFormatJSONObject {
    type: "json_object";
  }

  export interface ComparisonFilter {
    key: string;
    type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
    value: string | number | boolean | Array<string | number>;
  }

  export interface CompoundFilter {
    filters: Array<ComparisonFilter | unknown>;
    type: "and" | "or";
  }

  export type CustomToolInputFormat =
    | CustomToolInputFormat.Text
    | CustomToolInputFormat.Grammar;

  export namespace CustomToolInputFormat {
    export interface Text {
      type: "text";
    }

    export interface Grammar {
      definition: string;
      syntax: "lark" | "regex";
      type: "grammar";
    }
  }
}

export namespace ResponsesAPI {
  export interface ContainerNetworkPolicyDisabled {
    type: "disabled";
  }

  export interface ContainerNetworkPolicyAllowlist {
    allowed_domains: Array<string>;
    type: "allowlist";
    domain_secrets?: Array<ContainerNetworkPolicyDomainSecret>;
  }

  export interface ContainerNetworkPolicyDomainSecret {
    domain: string;
    name: string;
    value: string;
  }
}

export interface ResponsePrompt {
  id: string;
  variables?: {
    [key: string]:
      | string
      | ResponseInputText
      | ResponseInputImage
      | ResponseInputFile;
  } | null;
  version?: string | null;
}

export interface ContainerAuto {
  type: "container_auto";
  file_ids?: Array<string>;
  memory_limit?: "1g" | "4g" | "16g" | "64g" | null;
  network_policy?:
    | ResponsesAPI.ContainerNetworkPolicyDisabled
    | ResponsesAPI.ContainerNetworkPolicyAllowlist;
  skills?: Array<SkillReference | InlineSkill>;
}

export interface ResponseError {
  code:
    | "server_error"
    | "rate_limit_exceeded"
    | "invalid_prompt"
    | "vector_store_timeout"
    | "invalid_image"
    | "invalid_image_format"
    | "invalid_base64_image"
    | "invalid_image_url"
    | "image_too_large"
    | "image_too_small"
    | "image_parse_error"
    | "image_content_policy_violation"
    | "invalid_image_mode"
    | "image_file_too_large"
    | "unsupported_image_media_type"
    | "empty_image_file"
    | "failed_to_download_image"
    | "image_file_not_found";
  message: string;
}

export type ResponseOutputItem =
  | ResponseOutputMessage
  | ResponseFileSearchToolCall
  | ResponseFunctionToolCall
  | ResponseFunctionWebSearch
  | ResponseComputerToolCall
  | ResponseReasoningItem
  | ResponseCompactionItem
  | ResponseInputItem.ImageGenerationCall
  | ResponseCodeInterpreterToolCall
  | ResponseInputItem.LocalShellCall
  | ResponseFunctionShellToolCall
  | ResponseFunctionShellToolCallOutput
  | ResponseInputItem.ApplyPatchCall
  | ResponseInputItem.ApplyPatchCallOutput
  | ResponseInputItem.McpCall
  | ResponseInputItem.McpListTools
  | ResponseInputItem.McpApprovalRequest
  | ResponseCustomToolCall;

export type ResponseStatus =
  | "completed"
  | "failed"
  | "in_progress"
  | "cancelled"
  | "queued"
  | "incomplete";

export interface ResponseUsage {
  input_tokens: number;
  input_tokens_details: ResponseUsage.InputTokensDetails;
  output_tokens: number;
  output_tokens_details: ResponseUsage.OutputTokensDetails;
  total_tokens: number;
}

export namespace ResponseUsage {
  export interface InputTokensDetails {
    cached_tokens: number;
  }

  export interface OutputTokensDetails {
    reasoning_tokens: number;
  }
}

export interface ResponseCompactionItem {
  id: string;
  encrypted_content: string;
  type: "compaction";
  created_by?: string;
}

export interface ResponseFunctionShellToolCall {
  id: string;
  action: ResponseFunctionShellToolCall.Action;
  call_id: string;
  environment?: LocalEnvironment | null;
  status?: "in_progress" | "completed" | "incomplete" | null;
  type: "function_shell_call";
  created_by?: string;
}

export namespace ResponseFunctionShellToolCall {
  export interface Action {
    commands: Array<string>;
    max_output_length?: number | null;
    timeout_ms?: number | null;
  }
}

export interface ResponseFunctionShellToolCallOutput {
  id: string;
  call_id: string;
  max_output_length: number | null;
  output: Array<ResponseFunctionShellToolCallOutput.Output>;
  status?: "in_progress" | "completed" | "incomplete" | null;
  type: "function_shell_call_output";
  created_by?: string;
}

export namespace ResponseFunctionShellToolCallOutput {
  export interface Output {
    outcome:
      | ResponseFunctionShellCallOutputContent.Timeout
      | ResponseFunctionShellCallOutputContent.Exit;
    stderr: string;
    stdout: string;
  }
}

export interface InlineSkill {
  description: string;
  name: string;
  source: InlineSkillSource;
  type: "inline";
}

export interface InlineSkillSource {
  data: string;
  media_type: "application/zip";
  type: "base64";
}

export interface SkillReference {
  skill_id: string;
  type: "skill_reference";
}

export interface ResponseFormatTextJSONSchemaConfig {
  name: string;
  schema: { [key: string]: unknown };
  type: "json_schema";
  description?: string;
  strict?: boolean | null;
}

export type ResponseFormatTextConfig =
  | Shared.ResponseFormatText
  | ResponseFormatTextJSONSchemaConfig
  | Shared.ResponseFormatJSONObject;

export interface ResponseTextConfig {
  format?: ResponseFormatTextConfig;
  verbosity?: "low" | "medium" | "high" | null;
}

export type ToolChoiceOptions = "none" | "auto" | "required";

export interface ToolChoiceAllowed {
  mode: "auto" | "required";
  tools: Array<{ [key: string]: unknown }>;
  type: "allowed_tools";
}

export interface ToolChoiceApplyPatch {
  type: "apply_patch";
}

export interface ToolChoiceCustom {
  name: string;
  type: "custom";
}

export interface ToolChoiceFunction {
  name: string;
  type: "function";
}

export interface ToolChoiceMcp {
  server_label: string;
  type: "mcp";
  name?: string | null;
}

export interface ToolChoiceShell {
  type: "shell";
}

export interface ToolChoiceTypes {
  type:
    | "file_search"
    | "web_search_preview"
    | "computer_use_preview"
    | "web_search_preview_2025_03_11"
    | "image_generation"
    | "code_interpreter"
    | "mcp";
}

export type Tool =
  | FunctionTool
  | FileSearchTool
  | ComputerTool
  | WebSearchTool
  | Tool.Mcp
  | Tool.CodeInterpreter
  | Tool.ImageGeneration
  | Tool.LocalShell
  | FunctionShellTool
  | CustomTool
  | WebSearchPreviewTool
  | ApplyPatchTool;

export interface ComputerTool {
  display_height: number;
  display_width: number;
  environment: "windows" | "mac" | "linux" | "ubuntu" | "browser";
  type: "computer_use_preview";
}

export interface FileSearchTool {
  type: "file_search";
  vector_store_ids: Array<string>;
  filters?: Shared.ComparisonFilter | Shared.CompoundFilter | null;
}

export interface FunctionTool {
  name: string;
  parameters: { [key: string]: unknown } | null;
  strict: boolean | null;
  type: "function";
  description?: string | null;
}

export interface WebSearchTool {
  type: "web_search" | "web_search_2025_08_26";
  user_location?: WebSearchTool.UserLocation | null;
}

export namespace WebSearchTool {
  export interface UserLocation {
    city?: string | null;
    country?: string | null;
    region?: string | null;
    timezone?: string | null;
    type?: "approximate";
  }
}

export namespace Tool {
  export interface Mcp {
    server_label: string;
    type: "mcp";
    allowed_tools?: Array<string> | Mcp.McpToolFilter | null;
    authorization?: string;
    connector_id?:
      | "connector_dropbox"
      | "connector_gmail"
      | "connector_googlecalendar"
      | "connector_googledrive"
      | "connector_microsoftteams"
      | "connector_outlookcalendar"
      | "connector_outlookemail"
      | "connector_sharepoint";
    headers?: { [key: string]: string } | null;
    require_approval?: Mcp.McpToolApprovalFilter | "always" | "never" | null;
    server_description?: string;
    server_url?: string;
  }

  export namespace Mcp {
    export interface McpToolFilter {
      read_only?: boolean;
      tool_names?: Array<string>;
    }

    export interface McpToolApprovalFilter {
      always?: McpToolApprovalFilter.Always;
      never?: McpToolApprovalFilter.Never;
    }

    export namespace McpToolApprovalFilter {
      export interface Always {
        read_only?: boolean;
        tool_names?: Array<string>;
      }

      export interface Never {
        read_only?: boolean;
        tool_names?: Array<string>;
      }
    }
  }

  export interface CodeInterpreter {
    container: string | CodeInterpreter.CodeInterpreterToolAuto;
    type: "code_interpreter";
  }

  export namespace CodeInterpreter {
    export interface CodeInterpreterToolAuto {
      type: "auto";
      file_ids?: Array<string>;
      memory_limit?: "1g" | "4g" | "16g" | "64g" | null;
      network_policy?:
        | ResponsesAPI.ContainerNetworkPolicyDisabled
        | ResponsesAPI.ContainerNetworkPolicyAllowlist;
    }
  }

  export interface ImageGeneration {
    type: "image_generation";
    action?: "generate" | "edit" | "auto";
    background?: "transparent" | "opaque" | "auto";
    input_fidelity?: "high" | "low" | null;
    input_image_mask?: ImageGeneration.InputImageMask;
    model?:
      | (string & {})
      | "gpt-image-1"
      | "gpt-image-1-mini"
      | "gpt-image-1.5";
    moderation?: "auto" | "low";
    output_compression?: number;
    output_format?: "png" | "webp" | "jpeg";
    partial_images?: number;
    quality?: "low" | "medium" | "high" | "auto";
    size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  }

  export namespace ImageGeneration {
    export interface InputImageMask {
      file_id?: string;
      image_url?: string;
    }
  }

  export interface LocalShell {
    type: "local_shell";
  }
}

export interface FunctionShellTool {
  type: "shell";
  environment?: ContainerAuto | LocalEnvironment | ContainerReference | null;
}

export interface CustomTool {
  name: string;
  type: "custom";
  description?: string;
  format?: Shared.CustomToolInputFormat;
}

export interface WebSearchPreviewTool {
  type: "web_search_preview" | "web_search_preview_2025_03_11";
  search_context_size?: "low" | "medium" | "high";
  user_location?: WebSearchPreviewTool.UserLocation | null;
}

export namespace WebSearchPreviewTool {
  export interface UserLocation {
    type:
      | "approximate"
      | "country"
      | "city"
      | "region"
      | "postal_code"
      | "ip_address";
    country?: string;
    region?: string;
    city?: string;
    postal_code?: string;
    ip_address?: string;
  }
}

export interface ApplyPatchTool {
  type: "apply_patch";
}

// ---------------------------------------
// Create Response
// ---------------------------------------

export interface ResponseCreateParamsBase {
  background?: boolean | null;

  context_management?: Array<ResponseCreateParams.ContextManagement> | null;

  conversation?: string | ResponseConversationParam | null;

  include?: Array<ResponseIncludable> | null;

  input?: string | ResponseInput;

  instructions?: string | null;

  max_output_tokens?: number | null;

  metadata?: Shared.Metadata | null;

  model?: Shared.ResponsesModel;

  parallel_tool_calls?: boolean | null;

  previous_response_id?: string | null;

  prompt?: ResponsePrompt | null;

  prompt_cache_key?: string;

  prompt_cache_retention?: "in-memory" | "24h" | null;

  reasoning?: Shared.Reasoning | null;

  safety_identifier?: string;

  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;

  store?: boolean | null;

  stream?: boolean | null;

  stream_options?: ResponseCreateParams.StreamOptions | null;

  temperature?: number | null;

  text?: ResponseTextConfig;

  tool_choice?:
    | ToolChoiceOptions
    | ToolChoiceAllowed
    | ToolChoiceTypes
    | ToolChoiceFunction
    | ToolChoiceMcp
    | ToolChoiceCustom
    | ToolChoiceApplyPatch
    | ToolChoiceShell;

  tools?: Array<Tool>;

  top_p?: number | null;

  truncation?: "auto" | "disabled" | null;

  /**
   * @deprecated This field is being replaced by `safety_identifier` and
   * `prompt_cache_key`. Use `prompt_cache_key` instead to maintain caching
   * optimizations. A stable identifier for your end-users. Used to boost cache hit
   * rates by better bucketing similar requests and to help OpenAI detect and prevent
   * abuse.
   * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers).
   */
  user?: string;
}

export namespace ResponseCreateParams {
  export interface ContextManagement {
    type: string;

    compact_threshold?: number | null;
  }

  export interface StreamOptions {
    include_obfuscation?: boolean;
  }
}

export interface ResponseConversationParam {
  id: string;
}

export type ResponseIncludable =
  | "file_search_call.results"
  | "web_search_call.results"
  | "web_search_call.action.sources"
  | "message.input_image.image_url"
  | "computer_call_output.output.image_url"
  | "code_interpreter_call.outputs"
  | "reasoning.encrypted_content"
  | "message.output_text.logprobs";

export type ResponseInput = Array<ResponseInputItem>;

export type ResponseInputItem =
  | EasyInputMessage
  | ResponseInputItem.Message
  | ResponseOutputMessage
  | ResponseFileSearchToolCall
  | ResponseComputerToolCall
  | ResponseInputItem.ComputerCallOutput
  | ResponseFunctionWebSearch
  | ResponseFunctionToolCall
  | ResponseInputItem.FunctionCallOutput
  | ResponseReasoningItem
  | ResponseCompactionItemParam
  | ResponseInputItem.ImageGenerationCall
  | ResponseCodeInterpreterToolCall
  | ResponseInputItem.LocalShellCall
  | ResponseInputItem.LocalShellCallOutput
  | ResponseInputItem.ShellCall
  | ResponseInputItem.ShellCallOutput
  | ResponseInputItem.ApplyPatchCall
  | ResponseInputItem.ApplyPatchCallOutput
  | ResponseInputItem.McpListTools
  | ResponseInputItem.McpApprovalRequest
  | ResponseInputItem.McpApprovalResponse
  | ResponseInputItem.McpCall
  | ResponseCustomToolCallOutput
  | ResponseCustomToolCall
  | ResponseInputItem.ItemReference;

export interface EasyInputMessage {
  content: string | ResponseInputMessageContentList;
  role: "user" | "assistant" | "system" | "developer";
  type?: "message";
}

export type ResponseInputMessageContentList = Array<ResponseInputContent>;

export type ResponseInputContent =
  | ResponseInputText
  | ResponseInputImage
  | ResponseInputFile;

export interface ResponseInputText {
  text: string;
  type: "input_text";
}

export interface ResponseInputImage {
  detail: "low" | "high" | "auto";
  type: "input_image";
  file_id?: string | null;
  image_url?: string | null;
}

export interface ResponseInputFile {
  file_id: string;
  filename?: string | null;
  type: "input_file";
}

export interface ResponseComputerToolCallOutputScreenshot {
  type: "computer_screenshot";
  file_id?: string;
  image_url?: string;
}

export interface ContainerReference {
  container_id: string;
  type: "container_reference";
}

export interface LocalEnvironment {
  type: "local";
  skills?: Array<LocalSkill>;
}

export interface LocalSkill {
  description: string;
  name: string;
  path: string;
}

export interface ResponseFunctionShellCallOutputContent {
  outcome:
    | ResponseFunctionShellCallOutputContent.Timeout
    | ResponseFunctionShellCallOutputContent.Exit;
  stderr: string;
  stdout: string;
}

export namespace ResponseFunctionShellCallOutputContent {
  export interface Timeout {
    type: "timeout";
  }

  export interface Exit {
    exit_code: number;
    type: "exit";
  }
}

export interface ResponseInputTextContent {
  text: string;
  type: "input_text";
}

export interface ResponseInputImageContent {
  type: "input_image";
  detail?: "low" | "high" | "auto" | null;
  file_id?: string | null;
  image_url?: string | null;
}

export interface ResponseInputFileContent {
  type: "input_file";
  file_data?: string | null;
  file_id?: string | null;
  file_url?: string | null;
}

export type ResponseFunctionCallOutputItem =
  | ResponseInputTextContent
  | ResponseInputImageContent
  | ResponseInputFileContent;

export type ResponseFunctionCallOutputItemList =
  Array<ResponseFunctionCallOutputItem>;

export namespace ResponseInputItem {
  export interface Message {
    content: ResponseInputMessageContentList;
    role: "user" | "system" | "developer";
    status?: "in_progress" | "completed" | "incomplete";
    type?: "message";
  }

  export interface ComputerCallOutput {
    call_id: string;
    output: ResponseComputerToolCallOutputScreenshot;
    type: "computer_call_output";
    id?: string | null;
    acknowledged_safety_checks?: Array<ComputerCallOutput.AcknowledgedSafetyCheck> | null;
    status?: "in_progress" | "completed" | "incomplete" | null;
  }

  export namespace ComputerCallOutput {
    export interface AcknowledgedSafetyCheck {
      id: string;
      code?: string | null;
      message?: string | null;
    }
  }

  export interface FunctionCallOutput {
    call_id: string;
    output: string | ResponseFunctionCallOutputItemList;
    type: "function_call_output";
    id?: string | null;
    status?: "in_progress" | "completed" | "incomplete" | null;
  }

  export interface ImageGenerationCall {
    id: string;
    result: string | null;
    status: "in_progress" | "completed" | "generating" | "failed";
    type: "image_generation_call";
  }

  export interface LocalShellCall {
    id: string;
    action: LocalShellCall.Action;
    call_id: string;
    status: "in_progress" | "completed" | "incomplete";
    type: "local_shell_call";
  }

  export namespace LocalShellCall {
    export interface Action {
      command: Array<string>;
      env: { [key: string]: string };
      type: "exec";
      timeout_ms?: number | null;
      user?: string | null;
      working_directory?: string | null;
    }
  }

  export interface LocalShellCallOutput {
    id: string;
    output: string;
    type: "local_shell_call_output";
    status?: "in_progress" | "completed" | "incomplete" | null;
  }

  export interface ShellCall {
    action: ShellCall.Action;
    call_id: string;
    type: "shell_call";
    id?: string | null;
    environment?: LocalEnvironment | ContainerReference | null;
    status?: "in_progress" | "completed" | "incomplete" | null;
  }

  export namespace ShellCall {
    export interface Action {
      commands: Array<string>;
      max_output_length?: number | null;
      timeout_ms?: number | null;
    }
  }

  export interface ShellCallOutput {
    call_id: string;
    output: Array<ResponseFunctionShellCallOutputContent>;
    type: "shell_call_output";
    id?: string | null;
    max_output_length?: number | null;
    status?: "in_progress" | "completed" | "incomplete" | null;
  }

  export interface ApplyPatchCall {
    call_id: string;
    operation:
      | ApplyPatchCall.CreateFile
      | ApplyPatchCall.DeleteFile
      | ApplyPatchCall.UpdateFile;
    status: "in_progress" | "completed";
    type: "apply_patch_call";
    id?: string | null;
  }

  export namespace ApplyPatchCall {
    export interface CreateFile {
      diff: string;
      path: string;
      type: "create_file";
    }

    export interface DeleteFile {
      path: string;
      type: "delete_file";
    }

    export interface UpdateFile {
      diff: string;
      path: string;
      type: "update_file";
    }
  }

  export interface ApplyPatchCallOutput {
    call_id: string;
    status: "completed" | "failed";
    type: "apply_patch_call_output";
    id?: string | null;
    output?: string | null;
  }

  export interface McpListTools {
    id: string;
    server_label: string;
    tools: Array<McpListTools.Tool>;
    type: "mcp_list_tools";
    error?: string | null;
  }

  export namespace McpListTools {
    export interface Tool {
      input_schema: unknown;
      name: string;
      annotations?: unknown | null;
      description?: string | null;
    }
  }

  export interface McpApprovalRequest {
    id: string;
    arguments: string;
    name: string;
    server_label: string;
    type: "mcp_approval_request";
  }

  export interface McpApprovalResponse {
    approval_request_id: string;
    approve: boolean;
    type: "mcp_approval_response";
    id?: string | null;
    reason?: string | null;
  }

  export interface McpCall {
    id: string;
    arguments: string;
    name: string;
    server_label: string;
    type: "mcp_call";
    approval_request_id?: string | null;
    error?: string | null;
    output?: string | null;
    status?: "in_progress" | "completed" | "incomplete" | "calling" | "failed";
  }

  export interface ItemReference {
    id: string;
    type?: "item_reference" | null;
  }
}

export interface ResponseOutputMessage {
  id: string;
  content: Array<ResponseOutputText | ResponseOutputRefusal>;
  role: "assistant";
  status: "in_progress" | "completed" | "incomplete";
  type: "message";
}

export interface ResponseOutputRefusal {
  refusal: string;
  type: "refusal";
}

export interface ResponseOutputText {
  annotations: Array<
    | ResponseOutputText.FileCitation
    | ResponseOutputText.URLCitation
    | ResponseOutputText.ContainerFileCitation
    | ResponseOutputText.FilePath
  >;
  text: string;
  type: "output_text";
  logprobs?: Array<ResponseOutputText.Logprob>;
}

export namespace ResponseOutputText {
  export interface FileCitation {
    file_id: string;
    filename: string;
    index: number;
    type: "file_citation";
  }

  export interface URLCitation {
    end_index: number;
    start_index: number;
    title: string;
    type: "url_citation";
    url: string;
  }

  export interface ContainerFileCitation {
    container_id: string;
    end_index: number;
    file_id: string;
    filename: string;
    start_index: number;
    type: "container_file_citation";
  }

  export interface FilePath {
    file_id: string;
    index: number;
    type: "file_path";
  }

  export interface Logprob {
    token: string;
    bytes: Array<number>;
    logprob: number;
    top_logprobs: Array<Logprob.TopLogprob>;
  }

  export namespace Logprob {
    export interface TopLogprob {
      token: string;
      bytes: Array<number>;
      logprob: number;
    }
  }
}

export interface ResponseFileSearchToolCall {
  id: string;
  queries: Array<string>;
  status: "in_progress" | "searching" | "completed" | "incomplete" | "failed";
  type: "file_search_call";
  results?: Array<ResponseFileSearchToolCall.Result> | null;
}

export namespace ResponseFileSearchToolCall {
  export interface Result {
    attributes?: { [key: string]: string | number | boolean } | null;
    file_id?: string;
    filename?: string;
    score?: number;
    text?: string;
  }
}

export interface ResponseComputerToolCall {
  id: string;
  action:
    | ResponseComputerToolCall.Click
    | ResponseComputerToolCall.DoubleClick
    | ResponseComputerToolCall.Drag
    | ResponseComputerToolCall.Keypress
    | ResponseComputerToolCall.Move
    | ResponseComputerToolCall.Screenshot
    | ResponseComputerToolCall.Scroll
    | ResponseComputerToolCall.Type
    | ResponseComputerToolCall.Wait;
  call_id: string;
  pending_safety_checks: Array<ResponseComputerToolCall.PendingSafetyCheck>;
  status: "in_progress" | "completed" | "incomplete";
  type: "computer_call";
}

export namespace ResponseComputerToolCall {
  export interface Click {
    button: "left" | "right" | "wheel" | "back" | "forward";
    type: "click";
    x: number;
    y: number;
  }

  export interface DoubleClick {
    type: "double_click";
    x: number;
    y: number;
  }

  export interface Drag {
    path: Array<Drag.Path>;
    type: "drag";
  }

  export namespace Drag {
    export interface Path {
      x: number;
      y: number;
    }
  }

  export interface Keypress {
    keys: Array<string>;
    type: "keypress";
  }

  export interface Move {
    type: "move";
    x: number;
    y: number;
  }

  export interface Screenshot {
    type: "screenshot";
  }

  export interface Scroll {
    scroll_x: number;
    scroll_y: number;
    type: "scroll";
    x: number;
    y: number;
  }

  export interface Type {
    text: string;
    type: "type";
  }

  export interface Wait {
    type: "wait";
  }

  export interface PendingSafetyCheck {
    code: string;
    message: string;
    type: string;
  }
}

export interface ResponseFunctionWebSearch {
  id: string;
  action:
    | ResponseFunctionWebSearch.Search
    | ResponseFunctionWebSearch.OpenPage
    | ResponseFunctionWebSearch.Find;
  status: "in_progress" | "searching" | "completed" | "failed";
  type: "web_search_call";
}

export namespace ResponseFunctionWebSearch {
  export interface Search {
    query: string;
    type: "search";
    queries?: Array<string>;
    sources?: Array<Search.Source>;
  }

  export namespace Search {
    export interface Source {
      type: "url";
      url: string;
    }
  }

  export interface OpenPage {
    type: "open_page";
    url?: string | null;
  }

  export interface Find {
    pattern: string;
    type: "find_in_page";
    url: string;
  }
}

export interface ResponseFunctionToolCall {
  arguments: string;
  call_id: string;
  name: string;
  type: "function_call";
  id?: string;
  status?: "in_progress" | "completed" | "incomplete";
}

export interface ResponseReasoningItem {
  id: string;
  summary: Array<ResponseReasoningItem.Summary>;
  type: "reasoning";
  content?: Array<ResponseReasoningItem.Content>;
  encrypted_content?: string | null;
  status?: "in_progress" | "completed" | "incomplete";
}

export namespace ResponseReasoningItem {
  export interface Summary {
    text: string;
    type: "summary_text";
  }

  export interface Content {
    text: string;
    type: "reasoning_text";
  }
}

export interface ResponseCompactionItemParam {
  encrypted_content: string;
  type: "compaction";
  id?: string | null;
}

export interface ResponseCodeInterpreterToolCall {
  id: string;
  code: string | null;
  container_id: string;
  outputs: Array<
    ResponseCodeInterpreterToolCall.Logs | ResponseCodeInterpreterToolCall.Image
  > | null;
  status:
    | "in_progress"
    | "completed"
    | "incomplete"
    | "interpreting"
    | "failed";
  type: "code_interpreter_call";
}

export namespace ResponseCodeInterpreterToolCall {
  export interface Logs {
    logs: string;
    type: "logs";
  }

  export interface Image {
    type: "image";
    url: string;
  }
}

export interface ResponseCustomToolCall {
  call_id: string;
  input: string;
  name: string;
  type: "custom_tool_call";
  id?: string;
}

export interface ResponseCustomToolCallOutput {
  call_id: string;
  output:
    | string
    | Array<ResponseInputText | ResponseInputImage | ResponseInputFile>;
  type: "custom_tool_call_output";
  id?: string;
}

export interface ResponseCreateParamsNonStreaming
  extends ResponseCreateParamsBase {
  stream?: false | null;
}

export interface ResponseCreateParamsStreaming
  extends ResponseCreateParamsBase {
  stream: true;
}

export type ResponseCreateParams =
  | ResponseCreateParamsNonStreaming
  | ResponseCreateParamsStreaming;

export interface Response {
  id: string;

  created_at: number;

  output_text: string;

  error: ResponseError | null;

  incomplete_details: Response.IncompleteDetails | null;

  instructions: string | Array<ResponseInputItem> | null;

  metadata: Shared.Metadata | null;

  model: Shared.ResponsesModel;

  object: "response";

  output: Array<ResponseOutputItem>;

  parallel_tool_calls: boolean;

  temperature: number | null;

  tool_choice:
    | ToolChoiceOptions
    | ToolChoiceAllowed
    | ToolChoiceTypes
    | ToolChoiceFunction
    | ToolChoiceMcp
    | ToolChoiceCustom
    | ToolChoiceApplyPatch
    | ToolChoiceShell;

  tools: Array<Tool>;

  top_p: number | null;

  background?: boolean | null;

  completed_at?: number | null;

  conversation?: Response.Conversation | null;

  max_output_tokens?: number | null;

  previous_response_id?: string | null;

  prompt?: ResponsePrompt | null;

  prompt_cache_key?: string;

  prompt_cache_retention?: "in-memory" | "24h" | null;

  reasoning?: Shared.Reasoning | null;

  safety_identifier?: string;

  service_tier?: "auto" | "default" | "flex" | "scale" | "priority" | null;

  status?: ResponseStatus;

  text?: ResponseTextConfig;

  truncation?: "auto" | "disabled" | null;

  usage?: ResponseUsage;

  /**
   * @deprecated This field is being replaced by `safety_identifier` and
   * `prompt_cache_key`. Use `prompt_cache_key` instead to maintain caching
   * optimizations. A stable identifier for your end-users. Used to boost cache hit
   * rates by better bucketing similar requests and to help OpenAI detect and prevent
   * abuse.
   * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#safety-identifiers).
   */
  user?: string;
}

export namespace Response {
  export interface IncompleteDetails {
    reason?: "max_output_tokens" | "content_filter";
  }

  export interface Conversation {
    id: string;
  }
}

// ---------------------------------------
// Retrieve Response
// ---------------------------------------

export interface ResponseRetrieveParamsBase {
  include?: Array<ResponseIncludable>;
  include_obfuscation?: boolean;
  starting_after?: number;
  stream?: boolean;
}

export interface ResponseRetrieveParamsNonStreaming
  extends ResponseRetrieveParamsBase {
  stream?: false;
}

export interface ResponseRetrieveParamsStreaming
  extends ResponseRetrieveParamsBase {
  stream: true;
}

export type ResponseRetrieveParams =
  | ResponseRetrieveParamsNonStreaming
  | ResponseRetrieveParamsStreaming;

// ---------------------------------------
// Streaming Response Events
// ---------------------------------------

export interface ResponseCompletedEvent {
  response: Response;
  sequence_number: number;
  type: "response.completed";
}

export interface ResponseCreatedEvent {
  response: Response;
  sequence_number: number;
  type: "response.created";
}

export interface ResponseInProgressEvent {
  response: Response;
  sequence_number: number;
  type: "response.in_progress";
}

export type ResponseStreamEvent =
  | ResponseAudioDeltaEvent
  | ResponseAudioDoneEvent
  | ResponseAudioTranscriptDeltaEvent
  | ResponseAudioTranscriptDoneEvent
  | ResponseCodeInterpreterCallCodeDeltaEvent
  | ResponseCodeInterpreterCallCodeDoneEvent
  | ResponseCodeInterpreterCallCompletedEvent
  | ResponseCodeInterpreterCallInProgressEvent
  | ResponseCodeInterpreterCallInterpretingEvent
  | ResponseCompletedEvent
  | ResponseContentPartAddedEvent
  | ResponseContentPartDoneEvent
  | ResponseCreatedEvent
  | ResponseErrorEvent
  | ResponseFileSearchCallCompletedEvent
  | ResponseFileSearchCallInProgressEvent
  | ResponseFileSearchCallSearchingEvent
  | ResponseFunctionCallArgumentsDeltaEvent
  | ResponseFunctionCallArgumentsDoneEvent
  | ResponseInProgressEvent
  | ResponseFailedEvent
  | ResponseIncompleteEvent
  | ResponseOutputItemAddedEvent
  | ResponseOutputItemDoneEvent
  | ResponseReasoningSummaryPartAddedEvent
  | ResponseReasoningSummaryPartDoneEvent
  | ResponseReasoningSummaryTextDeltaEvent
  | ResponseReasoningSummaryTextDoneEvent
  | ResponseReasoningTextDeltaEvent
  | ResponseReasoningTextDoneEvent
  | ResponseRefusalDeltaEvent
  | ResponseRefusalDoneEvent
  | ResponseTextDeltaEvent
  | ResponseTextDoneEvent
  | ResponseWebSearchCallCompletedEvent
  | ResponseWebSearchCallInProgressEvent
  | ResponseWebSearchCallSearchingEvent
  | ResponseImageGenCallCompletedEvent
  | ResponseImageGenCallGeneratingEvent
  | ResponseImageGenCallInProgressEvent
  | ResponseImageGenCallPartialImageEvent
  | ResponseMcpCallArgumentsDeltaEvent
  | ResponseMcpCallArgumentsDoneEvent
  | ResponseMcpCallCompletedEvent
  | ResponseMcpCallFailedEvent
  | ResponseMcpCallInProgressEvent
  | ResponseMcpListToolsCompletedEvent
  | ResponseMcpListToolsFailedEvent
  | ResponseMcpListToolsInProgressEvent
  | ResponseOutputTextAnnotationAddedEvent
  | ResponseQueuedEvent
  | ResponseCustomToolCallInputDeltaEvent
  | ResponseCustomToolCallInputDoneEvent;

// Audio Events
export interface ResponseAudioDeltaEvent {
  delta: string;
  sequence_number: number;
  type: "response.audio.delta";
}

export interface ResponseAudioDoneEvent {
  sequence_number: number;
  type: "response.audio.done";
}

export interface ResponseAudioTranscriptDeltaEvent {
  delta: string;
  sequence_number: number;
  type: "response.audio.transcript.delta";
}

export interface ResponseAudioTranscriptDoneEvent {
  sequence_number: number;
  type: "response.audio.transcript.done";
}

// Code Interpreter Events
export interface ResponseCodeInterpreterCallCodeDeltaEvent {
  delta: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.code_interpreter_call_code.delta";
}

export interface ResponseCodeInterpreterCallCodeDoneEvent {
  code: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.code_interpreter_call_code.done";
}

export interface ResponseCodeInterpreterCallCompletedEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.code_interpreter_call.completed";
}

export interface ResponseCodeInterpreterCallInProgressEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.code_interpreter_call.in_progress";
}

export interface ResponseCodeInterpreterCallInterpretingEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.code_interpreter_call.interpreting";
}

// Basic Response Events
export interface ResponseContentPartAddedEvent {
  content_index: number;
  item_id: string;
  output_index: number;
  part:
    | ResponseOutputText
    | ResponseOutputRefusal
    | ResponseContentPartAddedEvent.ReasoningText;
  sequence_number: number;
  type: "response.content_part.added";
}

export namespace ResponseContentPartAddedEvent {
  export interface ReasoningText {
    text: string;
    type: "reasoning_text";
  }
}

export interface ResponseContentPartDoneEvent {
  content_index: number;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.content_part.done";
}

export interface ResponseErrorEvent {
  code:
    | "server_error"
    | "rate_limit_exceeded"
    | "invalid_prompt"
    | "vector_store_timeout"
    | "invalid_image"
    | "invalid_image_format"
    | "invalid_base64_image"
    | "invalid_image_url"
    | "image_too_large"
    | "image_too_small"
    | "image_parse_error"
    | "image_content_policy_violation"
    | "invalid_image_mode"
    | "image_file_too_large"
    | "unsupported_image_media_type"
    | "empty_image_file"
    | "failed_to_download_image"
    | "image_file_not_found";
  message: string;
  sequence_number: number;
  type: "response.error";
}

export interface ResponseFailedEvent {
  response: Response;
  sequence_number: number;
  type: "response.failed";
}

export interface ResponseIncompleteEvent {
  response: Response;
  sequence_number: number;
  type: "response.incomplete";
}

// Text and Reasoning Events
export interface ResponseReasoningTextDeltaEvent {
  content_index: number;
  delta: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.reasoning_text.delta";
}

export interface ResponseReasoningTextDoneEvent {
  content_index: number;
  item_id: string;
  output_index: number;
  sequence_number: number;
  text: string;
  type: "response.reasoning_text.done";
}

export interface ResponseTextDeltaEvent {
  content_index: number;
  delta: string;
  item_id: string;
  logprobs: Array<ResponseTextDeltaEvent.Logprob>;
  output_index: number;
  sequence_number: number;
  type: "response.output_text.delta";
}

export namespace ResponseTextDeltaEvent {
  export interface Logprob {
    token: string;
    logprob: number;
    bytes: Array<number>;
  }
}

export interface ResponseTextDoneEvent {
  content_index: number;
  item_id: string;
  logprobs: Array<ResponseTextDoneEvent.Logprob>;
  output_index: number;
  sequence_number: number;
  text: string;
  type: "response.output_text.done";
}

export namespace ResponseTextDoneEvent {
  export interface Logprob {
    token: string;
    logprob: number;
    bytes: Array<number>;
  }
}

// Placeholder interfaces for remaining events (to be implemented as needed)
export interface ResponseOutputItemAddedEvent {
  item: ResponseOutputItem;
  output_index: number;
  sequence_number: number;
  type: "response.output_item.added";
}

export interface ResponseOutputItemDoneEvent {
  item: ResponseOutputItem;
  output_index: number;
  sequence_number: number;
  type: "response.output_item.done";
}

export interface ResponseReasoningSummaryPartAddedEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.reasoning_summary_part.added";
}

export interface ResponseReasoningSummaryPartDoneEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.reasoning_summary_part.done";
}

export interface ResponseReasoningSummaryTextDeltaEvent {
  delta: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.reasoning_summary_text.delta";
}

export interface ResponseReasoningSummaryTextDoneEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  text: string;
  type: "response.reasoning_summary_text.done";
}

export interface ResponseRefusalDeltaEvent {
  delta: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.refusal.delta";
}

export interface ResponseRefusalDoneEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.refusal.done";
}

// File Search Events
export interface ResponseFileSearchCallCompletedEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.file_search_call.completed";
}

export interface ResponseFileSearchCallInProgressEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.file_search_call.in_progress";
}

export interface ResponseFileSearchCallSearchingEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.file_search_call.searching";
}

// Function Call Events
export interface ResponseFunctionCallArgumentsDeltaEvent {
  delta: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.function_call_arguments.delta";
}

export interface ResponseFunctionCallArgumentsDoneEvent {
  arguments: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.function_call_arguments.done";
}

// Web Search Events
export interface ResponseWebSearchCallCompletedEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.web_search_call.completed";
}

export interface ResponseWebSearchCallInProgressEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.web_search_call.in_progress";
}

export interface ResponseWebSearchCallSearchingEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.web_search_call.searching";
}

// Image Generation Events
export interface ResponseImageGenCallCompletedEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.image_gen_call.completed";
}

export interface ResponseImageGenCallGeneratingEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.image_gen_call.generating";
}

export interface ResponseImageGenCallInProgressEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.image_gen_call.in_progress";
}

export interface ResponseImageGenCallPartialImageEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.image_gen_call.partial_image";
}

// MCP Events
export interface ResponseMcpCallArgumentsDeltaEvent {
  delta: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.mcp_call_arguments.delta";
}

export interface ResponseMcpCallArgumentsDoneEvent {
  arguments: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.mcp_call_arguments.done";
}

export interface ResponseMcpCallCompletedEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.mcp_call.completed";
}

export interface ResponseMcpCallFailedEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.mcp_call.failed";
}

export interface ResponseMcpCallInProgressEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.mcp_call.in_progress";
}

export interface ResponseMcpListToolsCompletedEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.mcp_list_tools.completed";
}

export interface ResponseMcpListToolsFailedEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.mcp_list_tools.failed";
}

export interface ResponseMcpListToolsInProgressEvent {
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.mcp_list_tools.in_progress";
}

// Other Events
export interface ResponseOutputTextAnnotationAddedEvent {
  annotation:
    | ResponseOutputText.FileCitation
    | ResponseOutputText.URLCitation
    | ResponseOutputText.ContainerFileCitation
    | ResponseOutputText.FilePath;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.output_text.annotation_added";
}

export interface ResponseQueuedEvent {
  response: Response;
  sequence_number: number;
  type: "response.queued";
}

export interface ResponseCustomToolCallInputDeltaEvent {
  delta: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.custom_tool_call_input.delta";
}

export interface ResponseCustomToolCallInputDoneEvent {
  input: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  type: "response.custom_tool_call_input.done";
}

// ---------------------------------------
// Delete Response
// ---------------------------------------

// Delete response only requires a response ID and returns void
// No additional parameter types needed
export interface ResponseDeleteParams {
  response_id: string;
}
export type ResponseDeleteResponse = Response;

// ---------------------------------------
// List Input Items
// ---------------------------------------

export interface InputItemListParams {
  include?: Array<ResponseIncludable>;
  order?: "asc" | "desc";
  after?: string;
  limit?: number;
}

export interface ResponseItemList {
  data: Array<ResponseItem>;
  first_id: string;
  has_more: boolean;
  last_id: string;
  object: "list";
}

export type ResponseItem =
  | ResponseInputMessageItem
  | ResponseOutputMessage
  | ResponseFileSearchToolCall
  | ResponseComputerToolCall
  | ResponseComputerToolCallOutputItem
  | ResponseFunctionWebSearch
  | ResponseFunctionToolCallItem
  | ResponseFunctionToolCallOutputItem
  | ResponseItem.ImageGenerationCall
  | ResponseCodeInterpreterToolCall
  | ResponseItem.LocalShellCall
  | ResponseItem.LocalShellCallOutput
  | ResponseFunctionShellToolCall
  | ResponseFunctionShellToolCallOutput
  | ResponseApplyPatchToolCall
  | ResponseApplyPatchToolCallOutput
  | ResponseItem.McpListTools
  | ResponseItem.McpApprovalRequest
  | ResponseItem.McpApprovalResponse
  | ResponseItem.McpCall;

// Missing types for ResponseItem
export interface ResponseInputMessageItem {
  id: string;
  content: ResponseInputMessageContentList;
  role: "user" | "system" | "developer";
  status?: "in_progress" | "completed" | "incomplete" | null;
  type?: "message";
}

export interface ResponseComputerToolCallOutputItem {
  id: string;
  call_id: string;
  output: ResponseComputerToolCallOutputScreenshot;
  type: "computer_call_output";
  acknowledged_safety_checks?: Array<ResponseComputerToolCallOutputItem.AcknowledgedSafetyCheck>;
  status?: "in_progress" | "completed" | "incomplete";
}

export namespace ResponseComputerToolCallOutputItem {
  export interface AcknowledgedSafetyCheck {
    code: string;
    message: string;
    severity: "low" | "medium" | "high";
  }
}

export interface ResponseFunctionToolCallItem extends ResponseFunctionToolCall {
  id: string;
}

export interface ResponseFunctionToolCallOutputItem {
  id: string;
  call_id: string;
  output:
    | string
    | Array<ResponseInputText | ResponseInputImage | ResponseInputFile>;
  type: "function_call_output";
  status?: "in_progress" | "completed" | "incomplete";
}

export interface ResponseApplyPatchToolCall {
  id: string;
  call_id: string;
  operation:
    | ResponseApplyPatchToolCall.CreateFile
    | ResponseApplyPatchToolCall.DeleteFile
    | ResponseApplyPatchToolCall.UpdateFile;
  status: "in_progress" | "completed";
  type: "apply_patch_call";
  created_by?: string;
}

export namespace ResponseApplyPatchToolCall {
  export interface CreateFile {
    path: string;
    content: string;
    type: "create_file";
  }

  export interface DeleteFile {
    path: string;
    type: "delete_file";
  }

  export interface UpdateFile {
    path: string;
    content: string;
    type: "update_file";
  }
}

export interface ResponseApplyPatchToolCallOutput {
  id: string;
  call_id: string;
  output: ResponseApplyPatchToolCallOutput.Output;
  status?: "in_progress" | "completed" | "incomplete";
  type: "apply_patch_call_output";
}

export namespace ResponseApplyPatchToolCallOutput {
  export interface Output {
    outcome: Output.Success | Output.Failure;
    stderr: string;
    stdout: string;
  }

  export namespace Output {
    export interface Success {
      type: "success";
    }

    export interface Failure {
      type: "failure";
      error: string;
    }
  }
}

export namespace ResponseItem {
  export interface ImageGenerationCall {
    id: string;
    call_id: string;
    status?: "in_progress" | "completed" | "incomplete" | null;
    type: "image_generation_call";
    created_by?: string;
  }

  export interface LocalShellCall {
    id: string;
    call_id: string;
    status?: "in_progress" | "completed" | "incomplete" | null;
    type: "local_shell_call";
    created_by?: string;
  }

  export interface LocalShellCallOutput {
    id: string;
    call_id: string;
    status?: "in_progress" | "completed" | "incomplete" | null;
    type: "local_shell_call_output";
    created_by?: string;
  }

  export interface McpListTools {
    id: string;
    call_id: string;
    status?: "in_progress" | "completed" | "incomplete" | null;
    type: "mcp_list_tools";
    created_by?: string;
  }

  export interface McpApprovalRequest {
    id: string;
    call_id: string;
    status?: "in_progress" | "completed" | "incomplete" | null;
    type: "mcp_approval_request";
    created_by?: string;
  }

  export interface McpApprovalResponse {
    id: string;
    call_id: string;
    status?: "in_progress" | "completed" | "incomplete" | null;
    type: "mcp_approval_response";
    created_by?: string;
  }

  export interface McpCall {
    id: string;
    call_id: string;
    status?: "in_progress" | "completed" | "incomplete" | null;
    type: "mcp_call";
    created_by?: string;
  }
}

export type ResponseItemsPage = CursorPage<ResponseItem> & {
  object: "list";
};

export interface CursorPageParams {
  after?: string;
  limit?: number;
}

export interface CursorPageResponse<Item> {
  data: Array<Item>;
  has_more: boolean;
}

export interface CursorPage<Item> {
  data: Array<Item>;
  first_id?: string;
  last_id?: string;
  has_more: boolean;
}

// ---------------------------------------
// Cancel Response
// ---------------------------------------

// Cancel response requires a response ID and returns the cancelled Response
// Only responses created with `background: true` can be cancelled
// The cancelled response will have status: 'cancelled'
export interface ResponseCancelParams {
  response_id: string;
}
export type ResponseCancelResponse = Response;

// ---------------------------------------
// Compact Response
// ---------------------------------------

export interface ResponseCompactParams {
  model: string;
  input?: string | Array<ResponseInputItem> | null;
  instructions?: string | null;
  previous_response_id?: string | null;
}

export interface ResponseCompactedResponse {
  id: string;
  created_at: number;
  object: "response.compaction";
  output: Array<ResponseOutputItem>;
  usage: ResponseUsage;
}

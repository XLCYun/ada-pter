import type {
  ChatCompletion,
  ChatCompletionMessage,
  ChatCompletionMessageToolCall,
  RedactedThinkingBlockParam,
  ThinkingBlockParam,
} from "ada-pter/types/openai";
import { mapFinishReason, mapUsage, type ProviderSpecificFields } from "./response-shared";
import type {
  BashCodeExecutionToolResultBlock,
  CodeExecutionToolResultBlock,
  ContainerUploadBlock,
  Message,
  ServerToolUseBlock,
  TextBlock,
  TextEditorCodeExecutionToolResultBlock,
  ToolUseBlock,
  WebFetchToolResultBlock,
  WebSearchToolResultBlock,
} from "./types/messages";

export interface ExtractedContent {
  textContent: string;
  toolCalls: ChatCompletionMessageToolCall[];
  reasoningContent?: string;
  providerSpecificFields: ProviderSpecificFields;
}

export function extractResponseContent(message: Message): ExtractedContent {
  const content = message.content ?? [];
  return {
    textContent: content
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(""),
    toolCalls: content
      .filter((b): b is ToolUseBlock | ServerToolUseBlock => b.type === "tool_use" || b.type === "server_tool_use")
      .map(
        (b): ChatCompletionMessageToolCall => ({
          id: b.id,
          type: "function",
          function: {
            name: b.name,
            arguments: typeof b.input === "string" ? b.input : JSON.stringify(b.input ?? {}),
          },
        }),
      ),
    reasoningContent: content
      .filter((b): b is ThinkingBlockParam => b.type === "thinking")
      .map((b) => b.thinking)
      .join(""),
    providerSpecificFields: {
      citations: content
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => ({ text: b.text, citations: b.citations }))
        .filter((b) => b.citations != null && b.citations.length > 0)
        .map((b) =>
          b.citations!.map((citation) => ({
            ...citation,
            supported_text: b.text ?? "",
          })),
        ),
      thinking_blocks: content.filter(
        (b): b is ThinkingBlockParam | RedactedThinkingBlockParam =>
          b.type === "thinking" || b.type === "redacted_thinking",
      ),
      web_search_results: content.filter(
        (b): b is WebSearchToolResultBlock | WebFetchToolResultBlock =>
          b.type === "web_search_tool_result" || b.type === "web_fetch_tool_result",
      ),
      tool_results: content.filter(
        (
          b,
        ): b is
          | CodeExecutionToolResultBlock
          | BashCodeExecutionToolResultBlock
          | TextEditorCodeExecutionToolResultBlock =>
          b.type.endsWith("_tool_result") &&
          !["web_search_tool_result", "web_fetch_tool_result", "tool_search_tool_result"].includes(b.type),
      ),
      container_uploads: content.filter((b): b is ContainerUploadBlock => b.type === "container_upload"),
    },
  };
}

/** Message with optional provider_specific_fields */
export type ChatCompletionMessageWithProviderFields = ChatCompletionMessage & {
  provider_specific_fields?: ProviderSpecificFields;
};

type ErrorMessage = {
  type: "error";
  error: { type: string; message: string };
};

/**
 * Builds OpenAI ChatCompletion from Anthropic Message and extracted content.
 */
export function transformParsedResponse(message: Message | ErrorMessage): ChatCompletion {
  if (message.type === "error") {
    throw new Error(message?.error?.message ?? "Anthropic API error");
  }

  const extracted = extractResponseContent(message);
  const chatMessage: ChatCompletionMessageWithProviderFields = {
    role: "assistant",
    content: extracted.textContent || null,
    refusal: null,
    ...(extracted.toolCalls.length > 0 && { tool_calls: extracted.toolCalls }),
    thinking_blocks: extracted?.providerSpecificFields?.thinking_blocks,
    reasoning_content: extracted?.reasoningContent,
    provider_specific_fields: extracted.providerSpecificFields,
  };

  return {
    id: message.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: typeof message.model === "string" ? message.model : ((message.model as { id?: string })?.id ?? ""),
    choices: [
      {
        index: 0,
        message: chatMessage,
        finish_reason: mapFinishReason(message.stop_reason),
        logprobs: null,
      },
    ],
    usage: mapUsage(message.usage, extracted?.reasoningContent ?? ""),
  };
}

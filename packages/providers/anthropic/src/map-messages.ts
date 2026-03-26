import type {
  ChatCompletionContentPart,
  ChatCompletionContentPartImage,
  ChatCompletionMessageFunctionCall,
  ChatCompletionMessageParam,
} from "ada-pter/types/openai";
import type {
  Base64ImageSource,
  ContentBlockParam,
  ImageBlockParam,
  MessageParam,
  ServerToolUseBlockParam,
  TextBlockParam,
  ToolResultBlockParam,
  ToolUseBlockParam,
  WebSearchToolResultBlockParam,
} from "./types/messages";
import { mergeCacheControl } from "./utils";

/**
 * OpenAI `role` field possible values: system, developer, user, function, tool, assistant.
 *
 * - system, developer: mapped to Anthropic `system` messages.
 * - user, function, tool: mapped to Anthropic `user` messages.
 * - assistant: mapped to Anthropic `assistant` messages.
 */

type SystemExtraction = {
  systemBlocks: Array<TextBlockParam>;
  rest: ChatCompletionMessageParam[];
};

// Map to user messages: user, tool, function
type UserLikeMessage = Extract<ChatCompletionMessageParam, { role: "user" | "tool" | "function" }>;
const isUserLikeRole = (role: ChatCompletionMessageParam["role"]): boolean =>
  role === "user" || role === "tool" || role === "function";
const isUserLikeMsg = (msg: ChatCompletionMessageParam): msg is UserLikeMessage => isUserLikeRole(msg.role);

// Tool and function messages: tool, function
type ToolFunctionMessage = Extract<ChatCompletionMessageParam, { role: "tool" | "function" }>;
const isToolFunctionMsg = (msg: ChatCompletionMessageParam): msg is ToolFunctionMessage =>
  msg.role === "tool" || msg.role === "function";

// Assistant messages: assistant
type AssistantMessage = Extract<ChatCompletionMessageParam, { role: "assistant" }>;
const isAssistantMsg = (msg: ChatCompletionMessageParam): msg is AssistantMessage => msg.role === "assistant";

export const extractSystem = (messages: ChatCompletionMessageParam[]): SystemExtraction => {
  const systemBlocks: Array<TextBlockParam> = [];
  const rest: ChatCompletionMessageParam[] = messages.filter((m) => m.role !== "system" && m.role !== "developer");

  messages
    .filter((m) => m.role === "system" || m.role === "developer")
    .forEach((m) => {
      // Skip empty text blocks - Anthropic API raises errors for empty text

      const content = m.content;
      if (typeof content === "string") {
        if (content.length === 0) return;
        systemBlocks.push({ type: "text", text: content });
        return;
      }

      if (Array.isArray(content)) {
        content
          .filter((part) => part.type === "text" && Boolean(part.text))
          .forEach((part) => void systemBlocks.push({ type: part.type, text: part.text }));
      }
    });

  return { systemBlocks, rest };
};

export const mapMessages = (messages: ChatCompletionMessageParam[]): MessageParam[] => {
  // 1. reduce: merge adjacent user-like messages and adjacent assistant messages, filter other messages, get ChatCompletionMessageParam[][]
  const groupedRaw = messages.reduce<ChatCompletionMessageParam[][]>((acc, msg) => {
    const last = acc[acc.length - 1];
    const lastMsg = last?.[0];
    if (isUserLikeMsg(msg)) {
      last && lastMsg && isUserLikeMsg(lastMsg) ? last.push(msg) : acc.push([msg]);
      return acc;
    }
    if (isAssistantMsg(msg)) {
      last && lastMsg && isAssistantMsg(lastMsg) ? last.push(msg) : acc.push([msg]);
      return acc;
    }
    return acc;
  }, []);

  // 2. map: map each chunk to MessageParam
  const grouped: MessageParam[] = groupedRaw.map((chunk): MessageParam => {
    const first = chunk[0];
    if (isUserLikeRole(first.role)) {
      return {
        role: "user",
        content: chunk.flatMap((m) => mapUserLikeMessage(m as UserLikeMessage)),
      };
    }
    // here chunk is guaranteed to be an assistant message
    return {
      role: "assistant",
      content: chunk.flatMap((m) => mapAssistantMessage(m as AssistantMessage)),
    };
  });

  trimLastAssistantWhitespace(grouped);
  return grouped;
};

const asString = (value: unknown): string => (value == null ? "" : String(value));
type OpenAIImageUrlValue = ChatCompletionContentPartImage["image_url"];

const mapImagePart = (imageUrl: OpenAIImageUrlValue): ImageBlockParam => {
  const url = imageUrl?.url ?? "";
  if (!url) throw new Error("image_url content missing url");

  const isHttp = url.startsWith("http://");
  const isHttps = url.startsWith("https://");
  if (isHttp || isHttps) {
    return { type: "image", source: { type: "url", url } };
  }

  const match = /^data:([^;]+);base64,(.+)$/.exec(url);
  const dataUrlSource: Base64ImageSource | null = match
    ? {
        type: "base64",
        media_type: match[1] as Base64ImageSource["media_type"],
        data: match[2],
      }
    : null;
  if (!dataUrlSource) {
    throw new Error("image_url content is not a valid http(s) or data URL");
  }
  return { type: "image", source: dataUrlSource };
};

const mapContentPart = (part: ChatCompletionContentPart): ContentBlockParam | null => {
  if (!part || typeof part !== "object") {
    const t = asString(part);
    return part == null || t.length === 0 ? null : { type: "text", text: t };
  }
  switch (part.type) {
    case "text": {
      const text = asString(part.text);
      return text ? mergeCacheControl({ type: "text" as const, text }, part) : null;
    }
    case "image_url": {
      return part.image_url ? mergeCacheControl(mapImagePart(part.image_url), part) : null;
    }
    case "file": {
      const fileObj = part.file;
      const fileId = fileObj?.file_id ?? fileObj?.file_data;
      if (!fileId) return null;
      return mergeCacheControl(
        {
          type: "container_upload",
          file_id: fileId,
        } as ContentBlockParam,
        part,
      );
    }
    // anthropic does not support input audio
    case "input_audio":
      return null;
    default:
      return null;
  }
};

function mapToolOrFunctionMessage(msg: ToolFunctionMessage): ContentBlockParam[] {
  const rawToolUseId =
    (msg as { tool_call_id?: string }).tool_call_id ??
    globalThis.crypto?.randomUUID?.() ??
    `tool_${Math.random().toString(36).slice(2, 12)}`;
  const toolUseId = rawToolUseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const content = msg.content;
  const returnContent = (content: ToolResultBlockParam["content"]) => {
    return [
      mergeCacheControl(
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content,
        } satisfies ToolResultBlockParam,
        msg,
      ),
    ];
  };

  // OpenAI tool/function message content type: string | Array<ChatCompletionContentPartText>
  if (typeof content === "string") return returnContent(content);
  if (!Array.isArray(content)) throw new Error("unknown content type");
  return returnContent(content.map(mapContentPart).filter((block): block is TextBlockParam => block?.type === "text"));
}

function mapUserLikeMessage(msg: UserLikeMessage): ContentBlockParam[] {
  if (isToolFunctionMsg(msg)) return mapToolOrFunctionMessage(msg);

  const content = msg.content;
  if (Array.isArray(content)) {
    return content.map(mapContentPart).filter((block): block is ContentBlockParam => block !== null);
  }
  return [mergeCacheControl({ type: "text", text: asString(content) }, msg)].filter(
    (block): block is TextBlockParam => block.text.length > 0,
  );
}

function parseToolArguments(raw: string | undefined, name: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Failed to parse tool arguments for "${name}": ${raw}`);
  }
}

function generateToolId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `tool_${Math.random().toString(36).slice(2, 12)}`;
}

type AnyContentPart = { type: string; [k: string]: unknown };
type AssistantProviderSpecificFields = {
  web_search_results?: unknown;
};
type AssistantMessageWithProviderFields = AssistantMessage & {
  provider_specific_fields?: AssistantProviderSpecificFields;
};

function mapAssistantContent(content: AssistantMessage["content"], msg: AssistantMessage): ContentBlockParam[] {
  if (typeof content === "string" && content.length > 0) {
    return [mergeCacheControl({ type: "text" as const, text: content }, msg)];
  }

  if (Array.isArray(content)) {
    const blocks: ContentBlockParam[] = [];
    for (const raw of content) {
      const part = raw as unknown as AnyContentPart;
      switch (part.type) {
        case "text": {
          const text = asString(part.text);
          if (text) blocks.push(mergeCacheControl({ type: "text" as const, text }, part));
          break;
        }
        case "refusal": {
          const refusal = asString(part.refusal);
          if (refusal) blocks.push({ type: "text", text: refusal });
          break;
        }
        // These types do not appear in OpenAI format; they are passthrough cases.
        case "thinking": {
          if (asString(part.thinking)) blocks.push(raw as unknown as ContentBlockParam);
          break;
        }
        case "redacted_thinking":
          blocks.push(raw as unknown as ContentBlockParam);
          break;
        case "server_tool_use":
        case "tool_search_tool_result":
          blocks.push(raw as unknown as ContentBlockParam);
          break;
        default:
          break;
      }
    }
    return blocks;
  }

  return [];
}

function mapAssistantToolCalls(msg: AssistantMessage): ContentBlockParam[] {
  const toolCalls = msg.tool_calls;
  if (!Array.isArray(toolCalls)) return [];

  const providerFields = (msg as AssistantMessageWithProviderFields).provider_specific_fields;
  const webSearchResults = Array.isArray(providerFields?.web_search_results) ? providerFields.web_search_results : [];

  return toolCalls
    .filter((e) => e.type === "function")
    .flatMap((call): ContentBlockParam[] => {
      const name = call.function.name;
      const input = parseToolArguments(call.function.arguments, name);
      if (!call.id.startsWith("srvtoolu_")) {
        return [mergeCacheControl({ type: "tool_use", id: call.id, name, input } satisfies ToolUseBlockParam, call)];
      }

      return [
        {
          type: "server_tool_use",
          id: call.id,
          name: name as ServerToolUseBlockParam["name"],
          input,
        } satisfies ServerToolUseBlockParam,
        // Restore the corresponding result for this server tool call
        ...webSearchResults.filter((e) => e?.tool_use_id === call.id).map((e) => e as WebSearchToolResultBlockParam),
      ];
    });
}

function mapAssistantFunctionCall(fc: ChatCompletionMessageFunctionCall): ContentBlockParam {
  return {
    type: "tool_use",
    id: generateToolId(),
    name: fc.name,
    input: parseToolArguments(fc.arguments, fc.name),
  } satisfies ToolUseBlockParam;
}

function mapAssistantMessage(msg: AssistantMessage): ContentBlockParam[] {
  // 1. thinking_blocks — must come first per Anthropic API requirement
  const thinkingBlocks: ContentBlockParam[] = Array.isArray(msg.thinking_blocks) ? msg.thinking_blocks : [];

  // 2. content blocks
  const contentBlocks = mapAssistantContent(msg.content, msg);

  // 3. tool_calls
  const toolUseBlocks: ContentBlockParam[] = mapAssistantToolCalls(msg);

  // 4. function_call (legacy)
  const functionCallBlock: ContentBlockParam[] = msg.function_call ? [mapAssistantFunctionCall(msg.function_call)] : [];

  return [...thinkingBlocks, ...contentBlocks, ...toolUseBlocks, ...functionCallBlock];
}

function trimLastAssistantWhitespace(messages: MessageParam[]) {
  if (messages.length === 0) return;

  const last = messages[messages.length - 1];
  if (last.role !== "assistant") return;
  if (typeof last.content === "string") {
    last.content = last.content.trimEnd();
    return;
  }

  if (!Array.isArray(last.content)) return;
  last.content
    .filter((e) => e?.type === "text")
    .forEach((e) => {
      e.text = e.text.trimEnd();
    });
}

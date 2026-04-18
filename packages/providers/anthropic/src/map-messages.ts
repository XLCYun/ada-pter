import type {
  ChatCompletionContentPart,
  ChatCompletionContentPartImage,
  ChatCompletionMessageFunctionCall,
  ChatCompletionMessageParam,
} from "ada-pter/types/openai";
import type {
  Base64ImageSource,
  ContainerUploadBlockParam,
  ContentBlockParam,
  DocumentBlockParam,
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

type FileContentPart = Extract<ChatCompletionContentPart, { type: "file" }>;

const guessMimeFromFilename = (filename?: string): string | undefined => {
  if (!filename) return undefined;
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext ?? ""];
};

/**
 * Map OpenAI `file` content part to Anthropic block.
 *
 * Priority:
 * 1. `file_data` (base64 data URL) → `document` block with base64/text source
 * 2. `file_id` with `format`:
 *    - `application/pdf` / `text/plain` → `document` with `{ type: "file", file_id }`
 *    - image MIME types → `image` with `{ type: "file", file_id }`
 *    - other → `container_upload`
 * 3. `file_id` without `format`:
 *    - URL → `document` with `{ type: "url", url }`
 *    - else → `container_upload`
 */
const mapFilePart = (part: FileContentPart): ContentBlockParam | null => {
  const { file_data, file_id, filename } = part.file ?? {};

  // 1. Priority: file_data (base64 data URL)
  if (file_data) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(file_data);
    if (!match) return null;
    const [, mime, data] = match;

    if (mime === "application/pdf") {
      return mergeCacheControl(
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data },
        } satisfies DocumentBlockParam,
        part,
      );
    }

    if (mime === "text/plain") {
      return mergeCacheControl(
        {
          type: "document",
          source: { type: "text", media_type: "text/plain", data },
        } satisfies DocumentBlockParam,
        part,
      );
    }

    if (mime.startsWith("image/")) {
      return mergeCacheControl(
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mime as Base64ImageSource["media_type"],
            data,
          },
        } satisfies ImageBlockParam,
        part,
      );
    }

    return null;
  }

  // 2. file_id: infer MIME from filename, then determine block type
  if (file_id) {
    const mime = guessMimeFromFilename(filename);

    if (mime === "application/pdf" || mime === "text/plain") {
      return mergeCacheControl(
        {
          type: "document",
          source: { type: "url", url: file_id },
        } satisfies DocumentBlockParam,
        part,
      );
    }

    if (mime?.startsWith("image/")) {
      return mergeCacheControl(
        {
          type: "image",
          source: { type: "url", url: file_id },
        } satisfies ImageBlockParam,
        part,
      );
    }

    return mergeCacheControl(
      {
        type: "container_upload",
        file_id,
      } satisfies ContainerUploadBlockParam,
      part,
    );
  }

  // 3. No file_data and no file_id
  return null;
};

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
      return mapFilePart(part);
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
  // mapMessage always produces array content

  if (!Array.isArray(last.content)) return;
  last.content
    .filter((e) => e?.type === "text")
    .forEach((e) => {
      e.text = e.text.trimEnd();
    });
}

import type { AdapterContext, ResponseTransformer } from "ada-pter";
import type {
  ChatCompletionChunk,
  ChatCompletionChunkChoiceDelta,
  ChatCompletionChunkChoiceDeltaToolCall,
  ThinkingBlock,
} from "ada-pter/types/openai";
import { mapFinishReason, mapUsage, type ProviderSpecificFields } from "./response-shared";
import type {
  RawContentBlockDeltaEvent,
  RawContentBlockStartEvent,
  RawErrorEvent,
  RawMessageDeltaEvent,
  RawMessageStartEvent,
  RawMessageStreamEvent,
  Usage,
} from "./types/messages";

// The overall type structure expanded for RawMessageStreamEvent
// See types/response.md
// The overall type structure expanded for ChatCompletionChunk
// See openai/completions/response.md

type StreamChoiceDelta = ChatCompletionChunkChoiceDelta & {
  provider_specific_fields?: ProviderSpecificFields;
};

type StreamState = {
  id: string;
  model: string;
  created: number;
  toolIndex: number;
  currentContentBlockType: string | null;
  currentToolCallArgsLength: number;
  webSearchResults: unknown[];
  toolResults: unknown[];
  reasoningContent: string;
};

const createStreamState = (): StreamState => ({
  id: "",
  model: "",
  created: Math.floor(Date.now() / 1000),
  toolIndex: -1,
  currentContentBlockType: null,
  currentToolCallArgsLength: 0,
  webSearchResults: [],
  toolResults: [],
  reasoningContent: "",
});

const hasAsyncIterator = (value: unknown): value is AsyncIterable<unknown> =>
  value != null && typeof value === "object" && Symbol.asyncIterator in value;

const asRawStreamEvent = (value: unknown): RawMessageStreamEvent | null => {
  return typeof (value as { type?: unknown })?.type === "string" ? (value as RawMessageStreamEvent) : null;
};

const asAnthropicUsageFromMessageDelta = (usage: RawMessageDeltaEvent["usage"]): Usage => ({
  input_tokens: usage.input_tokens ?? 0,
  output_tokens: usage.output_tokens ?? 0,
  cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
  cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
  cache_creation: null,
  inference_geo: null,
  server_tool_use: usage.server_tool_use ?? null,
  service_tier: null,
});

const getModelId = (model: RawMessageStartEvent["message"]["model"]): string =>
  typeof model === "string" ? model : ((model as { id?: string })?.id ?? "");

const makeChunk = (
  state: StreamState,
  delta: StreamChoiceDelta,
  finishReason: ChatCompletionChunk["choices"][number]["finish_reason"] = null,
  usage?: ChatCompletionChunk["usage"],
): ChatCompletionChunk => ({
  id: state.id,
  object: "chat.completion.chunk",
  created: state.created,
  model: state.model,
  choices: [{ index: 0, delta, finish_reason: finishReason }],
  usage,
});

const makeToolCallDelta = (
  index: number,
  argumentsText: string,
  id?: string,
  name?: string,
): ChatCompletionChunkChoiceDeltaToolCall => ({
  index,
  type: "function",
  ...(id != null && { id }),
  function: {
    ...(name != null && { name }),
    arguments: argumentsText,
  },
});

const handleContentBlockStart = (event: RawContentBlockStartEvent, state: StreamState): StreamChoiceDelta | null => {
  state.currentContentBlockType = event.content_block.type;
  state.currentToolCallArgsLength = 0;
  const block = event.content_block;

  if (block.type === "text") {
    if (!block.text) return null;
    return { content: block.text };
  }

  if (block.type === "tool_use" || block.type === "server_tool_use") {
    state.toolIndex += 1;
    // The tool's input json string will be provided later in content_block_delta events via input_json_delta.
    return {
      tool_calls: [makeToolCallDelta(state.toolIndex, "", block.id, block.name)],
    };
  }

  if (block.type === "redacted_thinking") {
    const thinkingBlocks: ThinkingBlock[] = [{ type: "redacted_thinking", data: block.data ?? "" }];
    return {
      thinking_blocks: thinkingBlocks,
      provider_specific_fields: { thinking_blocks: thinkingBlocks },
    };
  }

  if (!block.type.endsWith("_tool_result")) {
    // skip tool_search_tool_result as it's internal metadata
    if (block.type === "tool_search_tool_result") return null;
    if (block.type === "web_search_tool_result" || block.type === "web_fetch_tool_result") {
      state.webSearchResults.push(block);
      return { provider_specific_fields: { web_search_results: state.webSearchResults } };
    }

    state.toolResults.push(block);
    return { provider_specific_fields: { tool_results: state.toolResults } };
  }

  return null;
};

const handleContentBlockDelta = (event: RawContentBlockDeltaEvent, state: StreamState): StreamChoiceDelta | null => {
  const delta = event.delta;
  if (delta.type === "text_delta") {
    if (!delta.text) return null;
    return { content: delta.text };
  }

  if (delta.type === "input_json_delta") {
    if (state.currentContentBlockType !== "tool_use" && state.currentContentBlockType !== "server_tool_use")
      return null;
    const partial = delta.partial_json ?? "";
    state.currentToolCallArgsLength += partial.length;
    return {
      tool_calls: [makeToolCallDelta(state.toolIndex, partial)],
    };
  }

  if (delta.type === "citations_delta") {
    return { provider_specific_fields: { citation: delta.citation } };
  }

  if (delta.type === "thinking_delta" || delta.type === "signature_delta") {
    const thinkingBlock: ThinkingBlock = {
      type: "thinking",
      thinking: delta.type === "thinking_delta" ? (delta.thinking ?? "") : "",
      signature: delta.type === "signature_delta" ? (delta.signature ?? "") : "",
    };
    if (thinkingBlock.thinking.length > 0) {
      state.reasoningContent += thinkingBlock.thinking;
    }
    return {
      thinking_blocks: [thinkingBlock],
      reasoning_content: state.reasoningContent || null,
      provider_specific_fields: { thinking_blocks: [thinkingBlock] },
    };
  }

  return null;
};

const handleContentBlockStop = (state: StreamState): StreamChoiceDelta | null => {
  state.currentContentBlockType = null;
  const isToolBlock =
    state.currentContentBlockType === "tool_use" || state.currentContentBlockType === "server_tool_use";
  if (!isToolBlock) return null;
  if (state.currentToolCallArgsLength > 0) return null;
  return { tool_calls: [makeToolCallDelta(state.toolIndex, "{}")] };
};

const handleMessageStart = (event: RawMessageStartEvent, state: StreamState): ChatCompletionChunk => {
  state.id = event.message.id;
  state.model = getModelId(event.message.model);
  const usage = mapUsage(event.message.usage, null);
  return makeChunk(state, { role: "assistant" }, null, usage);
};

const handleMessageDelta = (event: RawMessageDeltaEvent, state: StreamState): ChatCompletionChunk | null => {
  const finishReason = mapFinishReason(event.delta.stop_reason);
  const usage = mapUsage(asAnthropicUsageFromMessageDelta(event.usage), state.reasoningContent || null);
  const provider_specific_fields: ProviderSpecificFields | undefined =
    event.delta.container != null ? { container_uploads: event.delta.container as unknown } : undefined;
  const delta: StreamChoiceDelta = provider_specific_fields ? { provider_specific_fields } : {};
  return makeChunk(state, delta, finishReason, usage);
};

const handleStreamError = (event: RawErrorEvent): never => {
  const message = event.error?.message ?? "Anthropic stream error";
  throw new Error(message);
};

export const anthropicStreamingTransformer: ResponseTransformer = async (ctx: AdapterContext): Promise<void> => {
  const data = ctx.response.data;
  if (!hasAsyncIterator(data)) return;

  ctx.response.data = (async function* () {
    const state = createStreamState();
    for await (const rawChunk of data) {
      const event = asRawStreamEvent(rawChunk);
      if (!event) continue;

      if (event.type === "error") handleStreamError(event);

      if (event.type === "message_start") {
        yield handleMessageStart(event, state);
        continue;
      }

      if (event.type === "message_delta") {
        yield handleMessageDelta(event, state);
        continue;
      }

      if (event.type === "content_block_start") {
        const delta = handleContentBlockStart(event, state);
        if (!delta) continue;
        yield makeChunk(state, delta);
        continue;
      }

      if (event.type === "content_block_delta") {
        const delta = handleContentBlockDelta(event, state);
        if (!delta) continue;
        yield makeChunk(state, delta);
        continue;
      }

      if (event.type === "content_block_stop") {
        const delta = handleContentBlockStop(state);
        if (!delta) continue;
        yield makeChunk(state, delta);
      }

      if (event.type === "message_stop") continue;

      throw new Error(`Unknown Anthropic event type: ${event.type}`);
    }
  })();
};

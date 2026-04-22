import type {
  CompletionChunk,
  CompletionResponse,
} from "../types";
import type {
  ChatCompletionChoice,
  ChatCompletionChunkChoiceDelta,
  ChatCompletionMessage,
  CompletionUsage,
} from "../types/openai/completions/response";

/**
 * Merge an array of ChatCompletionChunks into a single ChatCompletion.
 *
 * Each chunk's `choices[].delta` is accumulated per choice index:
 * - `content` / `function_call.arguments` are concatenated
 * - `tool_calls` are grouped by (choice index, tool call index) and arguments concatenated
 * - `thinking_blocks` are flattened
 * - `reasoning_content` / `refusal` / `logprobs` / `finish_reason` take the last non-null value
 * - `usage` is taken from the last chunk that carries it
 */

type FinishReason = ChatCompletionChoice["finish_reason"];

interface AccumulatedToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
  type: "function";
}

interface ChoiceAccumulator {
  content: string;
  refusal: string | null;
  role: "assistant" | null;
  functionCallName: string | null;
  functionCallArguments: string;
  toolCalls: Map<number, AccumulatedToolCall>;
  thinkingBlocks: NonNullable<ChatCompletionMessage["thinking_blocks"]>;
  reasoningContent: string | null;
  finishReason: FinishReason | null;
  logprobs: ChatCompletionChoice["logprobs"];
}

const createChoiceAccumulator = (): ChoiceAccumulator => ({
  content: "",
  refusal: null,
  role: null,
  functionCallName: null,
  functionCallArguments: "",
  toolCalls: new Map(),
  thinkingBlocks: [],
  reasoningContent: null,
  finishReason: null,
  logprobs: null,
});

function mergeDelta(acc: ChoiceAccumulator, delta: ChatCompletionChunkChoiceDelta): void {
  if (delta.content != null) {
    acc.content += delta.content;
  }

  // role: take first non-empty value (should always be "assistant" for completion responses)
  if (delta.role && !acc.role) {
    acc.role = delta.role as "assistant";
  }

  if (delta.refusal != null) {
    acc.refusal = delta.refusal;
  }

  if (delta.function_call) {
    if (delta.function_call.name) acc.functionCallName = delta.function_call.name;
    if (delta.function_call.arguments) acc.functionCallArguments += delta.function_call.arguments;
  }

  if (delta.tool_calls) {
    for (const tc of delta.tool_calls) {
      let existing = acc.toolCalls.get(tc.index);
      if (!existing) {
        existing = { index: tc.index, id: "", name: "", arguments: "", type: "function" };
        acc.toolCalls.set(tc.index, existing);
      }
      if (tc.id) existing.id = tc.id;
      if (tc.function?.name) existing.name = tc.function.name;
      if (tc.function?.arguments) existing.arguments += tc.function.arguments;
    }
  }

  if (delta.thinking_blocks?.length) {
    acc.thinkingBlocks.push(...delta.thinking_blocks);
  }

  if (delta.reasoning_content != null) {
    acc.reasoningContent = (acc.reasoningContent ?? "") + delta.reasoning_content;
  }
}

function toChoice(acc: ChoiceAccumulator, index: number): ChatCompletionChoice {
  const message: ChatCompletionMessage = {
    role: acc.role ?? "assistant",
    content: acc.content || null,
    refusal: acc.refusal,
  };

  // function_call: include if we have any content (name defaults to empty string if missing)
  if (acc.functionCallName || acc.functionCallArguments) {
    message.function_call = {
      name: acc.functionCallName ?? "",
      arguments: acc.functionCallArguments,
    };
  } else {
    message.function_call = null;
  }

  if (acc.toolCalls.size > 0) {
    const sorted = [...acc.toolCalls.values()].sort((a, b) => a.index - b.index);
    message.tool_calls = sorted.map((tc) => ({
      id: tc.id,
      type: tc.type,
      function: { name: tc.name, arguments: tc.arguments },
    }));
  }

  if (acc.thinkingBlocks.length > 0) {
    message.thinking_blocks = acc.thinkingBlocks;
  }

  if (acc.reasoningContent != null) {
    message.reasoning_content = acc.reasoningContent;
  }

  return {
    index,
    finish_reason: acc.finishReason ?? "stop",
    message,
    logprobs: acc.logprobs,
  };
}

export function mergeChunks(chunks: CompletionChunk[]): CompletionResponse {
  if (chunks.length === 0) {
    throw new Error("Stream produced no chunks");
  }

  const first = chunks[0];
  let usage: CompletionUsage | undefined;

  // Accumulate choices by index
  const choiceAccs = new Map<number, ChoiceAccumulator>();

  for (const chunk of chunks) {
    // Capture usage from the last chunk that has it
    if (chunk.usage != null) {
      usage = chunk.usage;
    }

    for (const choice of chunk.choices ?? []) {
      let acc = choiceAccs.get(choice.index);
      if (!acc) {
        acc = createChoiceAccumulator();
        choiceAccs.set(choice.index, acc);
      }

      mergeDelta(acc, choice.delta);

      // finish_reason
      if (choice.finish_reason != null) {
        acc.finishReason = choice.finish_reason;
      }

      // logprobs
      if (choice.logprobs != null) {
        acc.logprobs = choice.logprobs;
      }
    }
  }

  // Build sorted choices
  const sortedIndexes = [...choiceAccs.keys()].sort((a, b) => a - b);
  const choices = sortedIndexes.map((idx) => toChoice(choiceAccs.get(idx)!, idx));

  return {
    id: first.id,
    object: "chat.completion",
    created: first.created,
    model: first.model,
    choices,
    ...(first.service_tier !== undefined && { service_tier: first.service_tier }),
    ...(first.system_fingerprint !== undefined && { system_fingerprint: first.system_fingerprint }),
    ...(usage && { usage }),
  };
}

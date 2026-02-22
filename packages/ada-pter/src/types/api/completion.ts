import type { AdapterConfig } from "../config";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
  ChatCompletionMessageParam,
} from "../openai/completions";

/**
 * Completion API call parameters.
 * Extends AdapterConfig so all config fields are available; only `messages` is required at call-level.
 * `model` can be set via configure() at global/API level, so it remains optional here.
 */
export type CompletionRequest = Partial<
  Omit<ChatCompletionCreateParamsBase, "model">
> &
  AdapterConfig;
export type CompletionResponse = ChatCompletion;
export type CompletionChunk = ChatCompletionChunk;
export type CompletionMessage = ChatCompletionMessageParam;

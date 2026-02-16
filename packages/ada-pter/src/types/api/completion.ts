import type { AdapterConfig } from "../config";
import type { Choice, Message, Usage } from "./common";

/**
 * Completion API call parameters.
 * Extends AdapterConfig so all config fields are available; only `messages` is required at call-level.
 * `model` can be set via configure() at global/API level, so it remains optional here.
 */
export interface CompletionRequest extends AdapterConfig {
  /** List of conversation messages (required for completion calls). */
  messages: Message[];
}

/** Unified completion response format (aligned with OpenAI format). */
export interface CompletionResponse {
  /** Unique request ID. */
  id: string;
  /** Actual model name used. */
  model: string;
  /** List of candidate replies. */
  choices: Choice[];
  /** Token usage statistics (some providers may not return this). */
  usage?: Usage;
}

/** A single chunk of a streaming response. */
export interface StreamChunk {
  /** Chunk ID (optional; some providers do not return this). */
  id?: string;
  /** Incremental text content. */
  content?: string;
  /** Role (typically only present in the first chunk). */
  role?: string;
  /** Finish reason (only present in the last chunk). */
  finishReason?: string | null;
}

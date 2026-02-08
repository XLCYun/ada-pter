import type { Choice, Message, Usage } from './common';

/** Completion request parameters (passed by the user when calling adapter.completion()). */
export interface CompletionRequest {
  /** Model identifier. Supports "provider/model" prefix format or plain model name. */
  model: string;
  /** List of conversation messages. */
  messages: Message[];
  /** Optional: temperature (can also be set via three-level config merge). */
  temperature?: number;
  /** Optional: maximum number of tokens to generate (can also be set via three-level config merge). */
  maxTokens?: number;
  /** Optional: abort signal. */
  signal?: AbortSignal;
  // More fields can be added in the future: topP, frequencyPenalty, tools, etc.
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

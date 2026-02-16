/** A conversation message. */
export interface Message {
  /** Role: system (system prompt), user (user input), assistant (model reply). */
  role: "system" | "user" | "assistant" | (string & {});
  /** Message content. */
  content: string;
}

/** A model reply choice (one candidate reply in a completion response). */
export interface Choice {
  /** Choice index (used to distinguish between multiple candidates). */
  index: number;
  /** Reply message. */
  message: Message;
  /** Finish reason: 'stop' (normal end), 'length' (reached maxTokens), 'content_filter', etc. */
  finishReason: string | null;
}

/** Token usage statistics. */
export interface Usage {
  /** Number of input tokens. */
  promptTokens: number;
  /** Number of output tokens. */
  completionTokens: number;
  /** Total number of tokens. */
  totalTokens: number;
}

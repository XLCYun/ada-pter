// ------------------------------------------------------
// extra thinking block support
// ------------------------------------------------------
export interface ThinkingBlockParam {
  signature: string;
  thinking: string;
  type: "thinking";
}

export interface RedactedThinkingBlockParam {
  data: string;
  type: "redacted_thinking";
}

export type ThinkingBlock = ThinkingBlockParam | RedactedThinkingBlockParam;

// ------------------------------------------------------
// end: extra thinking block support
// ------------------------------------------------------

// ------------------------------------------------------
// cache control support
// ------------------------------------------------------
export interface CacheControlEphemeral {
  type: "ephemeral";
  ttl?: "5m" | "1h";
}
// ------------------------------------------------------
// end: cache control support
// ------------------------------------------------------

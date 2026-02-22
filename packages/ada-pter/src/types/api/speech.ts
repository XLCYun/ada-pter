import type { AdapterConfig } from "../config";
import type { SpeechCreateParams, SpeechStreamEvent } from "../openai/speech";

export type SpeechRequest = Partial<
  Omit<SpeechCreateParams, "model" | "stream_format">
> &
  AdapterConfig;

export type SpeechResponse = ArrayBuffer;
export type SpeechStreamChunk = SpeechStreamEvent | string;

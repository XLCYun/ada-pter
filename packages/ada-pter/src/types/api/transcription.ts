import type { AdapterConfig } from "../config";
import type {
  TranscriptionCreateParams,
  TranscriptionCreateResponse,
  TranscriptionStreamEvent,
} from "../openai/transcriptions";

export type TranscriptionRequest = TranscriptionCreateParams & AdapterConfig;
export type TranscriptionResponse = TranscriptionCreateResponse | string;
export type TranscriptionStreamChunk = TranscriptionStreamEvent;

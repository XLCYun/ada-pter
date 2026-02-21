import type { AdapterConfig } from "../config";
import type {
  CreateEmbeddingInput,
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from "../openai/embeddings";

export type EmbeddingRequest = EmbeddingCreateParams & AdapterConfig;
export type EmbeddingResponse = CreateEmbeddingResponse;
export type EmbeddingInput = CreateEmbeddingInput;

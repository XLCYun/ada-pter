import type { AdapterConfig } from "../config";
import type {
  ImageGenerateParamsBase,
  ImageGenStreamEvent,
  ImagesResponse,
} from "../openai/images";

export type ImageGenerationRequest = Partial<
  Omit<ImageGenerateParamsBase, "model">
> &
  AdapterConfig;
export type ImageGenerationResponse = ImagesResponse;
export type ImageGenerationStreamChunk = ImageGenStreamEvent;

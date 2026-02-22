// Standalone type definitions for images.generate

export interface ImagesGenerateAPI {
  generate(
    body: ImageGenerateParamsNonStreaming,
    options?: RequestOptions,
  ): APIPromise<ImagesResponse>;
  generate(
    body: ImageGenerateParamsStreaming,
    options?: RequestOptions,
  ): APIPromise<Stream<ImageGenStreamEvent>>;
  generate(
    body: ImageGenerateParamsBase,
    options?: RequestOptions,
  ): APIPromise<Stream<ImageGenStreamEvent> | ImagesResponse>;
  generate(
    body: ImageGenerateParams,
    options?: RequestOptions,
  ): APIPromise<ImagesResponse> | APIPromise<Stream<ImageGenStreamEvent>>;
}

export type APIPromise<T> = Promise<T>;

export interface Stream<T> extends AsyncIterable<T> {}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

export interface Image {
  b64_json?: string;
  revised_prompt?: string;
  url?: string;
}

export interface ImageGenCompletedEvent {
  b64_json: string;
  background: "transparent" | "opaque" | "auto" | (string & {});
  created_at: number;
  output_format: "png" | "webp" | "jpeg" | (string & {});
  quality: "low" | "medium" | "high" | "auto" | (string & {});
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto" | (string & {});
  type: "image_generation.completed";
  usage: ImageGenCompletedEventUsage;
}

export interface ImageGenCompletedEventUsage {
  input_tokens: number;
  input_tokens_details: ImageGenCompletedEventInputTokensDetails;
  output_tokens: number;
  total_tokens: number;
}

export interface ImageGenCompletedEventInputTokensDetails {
  image_tokens: number;
  text_tokens: number;
}

export interface ImageGenPartialImageEvent {
  b64_json: string;
  background: "transparent" | "opaque" | "auto" | (string & {});
  created_at: number;
  output_format: "png" | "webp" | "jpeg" | (string & {});
  partial_image_index: number;
  quality: "low" | "medium" | "high" | "auto" | (string & {});
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto" | (string & {});
  type: "image_generation.partial_image";
}

export type ImageGenStreamEvent =
  | ImageGenPartialImageEvent
  | ImageGenCompletedEvent;

export type ImageModel = string;

export interface ImagesResponse {
  created: number;
  background?: "transparent" | "opaque" | (string & {});
  data?: Array<Image>;
  output_format?: "png" | "webp" | "jpeg" | (string & {});
  quality?: "low" | "medium" | "high" | (string & {});
  size?: "1024x1024" | "1024x1536" | "1536x1024" | (string & {});
  usage?: ImagesResponseUsage;
}

export interface ImagesResponseUsage {
  input_tokens: number;
  input_tokens_details: ImagesResponseInputTokensDetails;
  output_tokens: number;
  total_tokens: number;
  output_tokens_details?: ImagesResponseOutputTokensDetails;
}

export interface ImagesResponseInputTokensDetails {
  image_tokens: number;
  text_tokens: number;
}

export interface ImagesResponseOutputTokensDetails {
  image_tokens: number;
  text_tokens: number;
}

export type ImageGenerateParams =
  | ImageGenerateParamsNonStreaming
  | ImageGenerateParamsStreaming;

export interface ImageGenerateParamsBase {
  prompt: string;
  background?: "transparent" | "opaque" | "auto" | (string & {}) | null;
  model?: (string & {}) | ImageModel | null;
  moderation?: "low" | "auto" | (string & {}) | null;
  n?: number | null;
  output_compression?: number | null;
  output_format?: "png" | "jpeg" | "webp" | (string & {}) | null;
  partial_images?: number | null;
  quality?:
    | "standard"
    | "hd"
    | "low"
    | "medium"
    | "high"
    | "auto"
    | (string & {})
    | null;
  response_format?: "url" | "b64_json" | (string & {}) | null;
  size?:
    | "auto"
    | "1024x1024"
    | "1536x1024"
    | "1024x1536"
    | "256x256"
    | "512x512"
    | "1792x1024"
    | "1024x1792"
    | (string & {})
    | null;
  stream?: boolean | null;
  style?: "vivid" | "natural" | (string & {}) | null;
  user?: string;
}

export interface ImageGenerateParamsNonStreaming
  extends ImageGenerateParamsBase {
  stream?: false | null;
}

export interface ImageGenerateParamsStreaming extends ImageGenerateParamsBase {
  stream: true;
}

import type { AdapterContext, ApiHandler, RequestConfig } from "@ada-pter/core";
import {
  joinPath,
  jsonTransformer,
  resolveApiPath,
  sseTransformer,
} from "@ada-pter/core";
import type { ImageGenerateParamsBase } from "ada-pter/types/openai/images";
import { resolveRequestBase } from "./utils";

const IMAGE_GENERATION_PATH = "/images/generations";

const buildBody = (ctx: AdapterContext): ImageGenerateParamsBase => {
  const cfg = ctx.config as unknown as ImageGenerateParamsBase;
  return {
    prompt: cfg.prompt,
    model: ctx.model,
    background: cfg.background,
    moderation: cfg.moderation,
    n: cfg.n,
    output_compression: cfg.output_compression,
    output_format: cfg.output_format,
    partial_images: cfg.partial_images,
    quality: cfg.quality,
    response_format: cfg.response_format,
    size: cfg.size,
    stream: cfg.stream,
    style: cfg.style,
    user: cfg.user,
  };
};

const getRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const { base, headers } = resolveRequestBase(ctx);
  const path = resolveApiPath(ctx, {
    default: IMAGE_GENERATION_PATH,
  });
  const url = joinPath(base, path ?? IMAGE_GENERATION_PATH);

  return {
    url,
    method: "POST",
    headers,
    body: buildBody(ctx) as unknown as BodyInit,
  };
};

const imageGenerationHandler: ApiHandler = {
  getRequestConfig,
  responseTransformers: [jsonTransformer],
};

const streamingImageGenerationHandler: ApiHandler = {
  getRequestConfig,
  responseTransformers: [sseTransformer],
};

export function getImagesHandler(ctx: AdapterContext): ApiHandler | null {
  if (ctx.apiType !== "image.generation") return null;
  return ctx.config.stream
    ? streamingImageGenerationHandler
    : imageGenerationHandler;
}

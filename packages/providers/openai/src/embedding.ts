import type { AdapterContext, ApiHandler, RequestConfig } from "@ada-pter/core";
import { joinPath, jsonTransformer, resolveApiPath } from "@ada-pter/core";
import type { EmbeddingCreateParams } from "ada-pter/types/openai/embeddings";
import { resolveRequestBase } from "./utils";

const EMBEDDINGS_PATH = "/embeddings";

const getRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const cfg = ctx.config as unknown as EmbeddingCreateParams;
  const { base, headers } = resolveRequestBase(ctx);
  const path =
    resolveApiPath(ctx, { default: EMBEDDINGS_PATH }) ?? EMBEDDINGS_PATH;
  const url = joinPath(base, path);
  const body: EmbeddingCreateParams = {
    input: cfg.input,
    model: ctx.model,
    dimensions: cfg.dimensions,
    encoding_format: cfg.encoding_format,
    user: cfg.user,
  };
  return {
    url,
    method: "POST",
    headers,
    body: body as unknown as BodyInit,
  };
};

export const embeddingHandler: ApiHandler = {
  getRequestConfig,
  responseTransformers: [jsonTransformer],
};

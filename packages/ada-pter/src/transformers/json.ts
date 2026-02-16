import type { ResponseTransformer } from "../types";
import { getContentType, isJsonContentType } from "./utils";

// biome-ignore lint/complexity/noBannedTypes: no options for now
export type JsonTransformerOptions = {};

export function createJsonTransformer(
  _options: JsonTransformerOptions = {},
): ResponseTransformer {
  return async (ctx) => {
    const raw = ctx.response.raw;
    if (!raw) return;

    const contentType = getContentType(ctx);
    if (!isJsonContentType(contentType)) return;

    ctx.response.data = await raw.json();
  };
}

export const jsonTransformer: ResponseTransformer = createJsonTransformer({});

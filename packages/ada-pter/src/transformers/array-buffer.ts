import type { ResponseTransformer } from "../types";

export function createArrayBufferTransformer(): ResponseTransformer {
  return async (ctx) => {
    const raw = ctx.response.raw;
    if (!raw) return;
    ctx.response.data = await raw.arrayBuffer();
  };
}

export const arrayBufferTransformer: ResponseTransformer =
  createArrayBufferTransformer();

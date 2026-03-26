import type { CacheControlEphemeral } from "ada-pter/types/openai";

/**
 * 将 source 上的 cache_control 透传到 target，用于在映射时保留扩展的 cache_control 字段。
 */
export const mergeCacheControl = <T extends object>(
  target: T,
  source: object & { cache_control?: CacheControlEphemeral },
): T => {
  return {
    ...target,
    ...(source?.cache_control ? { cache_control: source.cache_control } : undefined),
  };
};

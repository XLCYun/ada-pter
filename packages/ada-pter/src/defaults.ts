import type { AdapterConfig } from "./types";

export const defaults: Partial<AdapterConfig> = {
  maxRetries: 2,
  retryDelay: 200,
};

import { inferOpenAIProvider } from "./openai";
import { MODEL_PROVIDER_REGISTRY } from "./registry";

export function inferProvider(model: string): string {
  model = model.toLowerCase();
  const fromRegistry = MODEL_PROVIDER_REGISTRY[model];
  if (fromRegistry) return fromRegistry;

  const openai = inferOpenAIProvider(model);
  if (openai) return openai;

  return "custom";
}

export function inferOpenAIProvider(model: string): string | null {
  if (model.startsWith("gpt-")) return "openai";
  if (model.startsWith("chatgpt-")) return "openai";
  return null;
}

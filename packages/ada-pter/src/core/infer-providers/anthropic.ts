export function inferAnthropicProvider(model: string): string | null {
  return model.startsWith("claude-") ? "anthropic" : null;
}

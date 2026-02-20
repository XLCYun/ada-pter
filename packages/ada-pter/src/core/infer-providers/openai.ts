export function inferOpenAIProvider(model: string): string | null {
  const match = [
    "gpt-",
    "sora-",
    "chatgpt-",
    "o1-",
    "o3-",
    "o4-",
    "babbage-",
    "dall-e",
    "codex-",
    "text-embedding-",
    "text-moderation",
    "tts-",
    "whisper",
  ].some((prefix) => model.startsWith(prefix));
  return match ? "openai" : null;
}

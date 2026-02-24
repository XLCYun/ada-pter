import { describe, expect, test } from "bun:test";
import { createAdapter } from "@ada-pter/core";
import { autoProvider } from "@ada-pter/openai";

const apiKey = process.env.OPENAI_API_KEY;
const canRun = Boolean(apiKey);
const live = canRun ? describe : describe.skip;

live("live: @ada-pter/openai speech", () => {
  const model = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";

  test("speech non-stream returns arraybuffer", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);

    const res = await a.speech({
      model,
      input: "Hi!",
      voice: "alloy",
      response_format: "mp3",
      timeout: 30_000,
    });

    expect(res).toBeInstanceOf(ArrayBuffer);
    expect((res as ArrayBuffer).byteLength).toBeGreaterThan(0);
  }, 60_000);

  test("speech stream yields chunks (sse)", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);

    const stream = a.speech({
      model,
      input: "Hi!",
      voice: "alloy",
      stream: true,
      timeout: 30_000,
    });

    let chunkCount = 0;
    for await (const chunk of stream) {
      expect(chunk).toBeDefined();
      chunkCount += 1;
    }

    expect(chunkCount).toBeGreaterThan(0);
  }, 60_000);
});

if (!canRun) {
  const reasons: string[] = [];
  if (!apiKey) reasons.push("OPENAI_API_KEY");
  console.info(`[live-test skipped] Missing: ${reasons.join(", ")}`);
}

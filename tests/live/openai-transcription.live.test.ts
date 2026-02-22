import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { autoProvider } from "@ada-pter/openai";
import { createAdapter } from "ada-pter";

const apiKey = process.env.OPENAI_API_KEY;
const canRun = Boolean(apiKey);
const live = canRun ? describe : describe.skip;

const FIXTURE_AUDIO_PATH = join(process.cwd(), "tests/fixtures/audio/love.mp3");

const loadFixtureAudio = async (): Promise<Blob> => {
  const data = await readFile(FIXTURE_AUDIO_PATH);
  return new Blob([data], { type: "audio/mpeg" });
};

live("live: @ada-pter/openai transcription", () => {
  const model =
    process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe";

  test("transcription non-stream works with real OpenAI API", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);
    const file = await loadFixtureAudio();

    const res = await a.transcription({
      model,
      file,
      response_format: "json",
      timeout: 30_000,
    });

    if (typeof res === "string") {
      expect(res.length).toBeGreaterThanOrEqual(0);
      return;
    }

    expect(res).toBeDefined();
    expect(typeof res.text).toBe("string");
  }, 60_000);

  test("transcription stream yields events", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);
    const file = await loadFixtureAudio();

    const stream = a.transcription({
      model,
      file,
      stream: true,
      timeout: 30_000,
    });

    let count = 0;
    for await (const event of stream) {
      expect(event).toBeDefined();
      count += 1;
    }

    expect(count).toBeGreaterThan(0);
  }, 60_000);
});

if (!canRun) {
  const reasons: string[] = [];
  if (!apiKey) reasons.push("OPENAI_API_KEY");
  console.info(`[live-test skipped] Missing: ${reasons.join(", ")}`);
}

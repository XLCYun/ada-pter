import { describe, expect, test } from "bun:test";
import { autoProvider } from "@ada-pter/openai";
import { createAdapter } from "ada-pter";

const apiKey = process.env.OPENAI_API_KEY;
const canRun = Boolean(apiKey);
const live = canRun ? describe : describe.skip;

live("live: @ada-pter/openai completion", () => {
  const modelEnv = process.env.OPENAI_MODEL ?? "gpt-5-nano";
  const model = modelEnv.includes("/") ? modelEnv : `openai/${modelEnv}`;

  test("non-stream completion works with real OpenAI API", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);

    const res = await a.completion({
      model,
      messages: [{ role: "user", content: "Reply with: pong" }],
      temperature: 1,
      timeout: 30_000,
    });

    expect(res.id).toBeString();
    expect(Array.isArray(res.choices)).toBe(true);
    expect(res.choices.length).toBeGreaterThan(0);
  });

  test("stream completion yields chunks", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);

    const stream = a.completion({
      model,
      stream: true,
      messages: [{ role: "user", content: "Reply with: pong" }],
      temperature: 1,
      timeout: 30_000,
    });

    let chunkCount = 0;
    for await (const chunk of stream) {
      expect(chunk).toBeDefined();
      console.warn(`chunk: ${JSON.stringify(chunk.choices)}`);
      chunkCount += 1;
    }

    expect(chunkCount).toBeGreaterThan(0);
  });
});

if (!canRun) {
  const reasons: string[] = [];
  if (!apiKey) reasons.push("OPENAI_API_KEY");
  console.info(`[live-test skipped] Missing: ${reasons.join(", ")}`);
}

import { describe, expect, test } from "bun:test";
import { createAdapter } from "@ada-pter/core";
import { autoProvider } from "@ada-pter/openai";

const apiKey = process.env.OPENAI_API_KEY;
const canRun = Boolean(apiKey);
const live = canRun ? describe : describe.skip;

live("live: @ada-pter/openai embedding", () => {
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

  test("embedding works with real OpenAI API", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);

    const res = await a.embedding({
      model,
      input: "ping",
      timeout: 30_000,
    });

    expect(res).toBeDefined();
    expect(res.object).toBe("list");
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0].embedding.length).toBeGreaterThan(0);
  });
});

if (!canRun) {
  const reasons: string[] = [];
  if (!apiKey) reasons.push("OPENAI_API_KEY");
  console.info(`[live-test skipped] Missing: ${reasons.join(", ")}`);
}

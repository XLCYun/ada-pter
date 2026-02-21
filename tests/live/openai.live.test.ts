import { describe, expect, test } from "bun:test";
import { autoProvider } from "@ada-pter/openai";
import { createAdapter } from "ada-pter";

const apiKey = process.env.OPENAI_API_KEY;
const canRun = Boolean(apiKey);
const live = canRun ? describe : describe.skip;

live("live: @ada-pter/openai completion", () => {
  const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";

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
      chunkCount += 1;
    }

    expect(chunkCount).toBeGreaterThan(0);
  });
});

live("live: @ada-pter/openai responses", () => {
  const model = process.env.OPENAI_MODEL ?? "gpt-5-nano";

  test("createResponse non-stream works with real OpenAI API", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);

    const res = await a.createResponse({
      model,
      input: "Reply with: pong",
      timeout: 30_000,
    });

    expect(res).toBeDefined();
    expect(res.id).toBeString();
  });

  test("createResponse stream yields chunks", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);

    const stream = a.createResponse({
      model,
      stream: true,
      input: "Reply with: pong",
      timeout: 30_000,
    });

    let chunkCount = 0;
    for await (const chunk of stream) {
      expect(chunk).toBeDefined();
      chunkCount += 1;
    }

    expect(chunkCount).toBeGreaterThan(0);
  });

  test("listResponseInputItems works with created response", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);

    const created = await a.createResponse({
      model,
      input: "Reply with: pong",
      timeout: 30_000,
    });
    expect(created.id).toBeString();

    const list = await a.listResponseInputItems({
      model,
      response_id: created.id,
      limit: 10,
      timeout: 30_000,
    });

    expect(list).toBeDefined();
    console.warn(`list: ${JSON.stringify(list.object)}`);
    expect(list.object).toBeString();
    expect(Array.isArray(list.data)).toBe(true);
  });

  test("cancelResponse works on a newly created background response", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);

    const created = await a.createResponse({
      model,
      input: "Generate a long answer about distributed systems.",
      background: true,
      timeout: 30_000,
    });
    expect(created.id).toBeString();

    const cancelled = await a.cancelResponse({
      model,
      response_id: created.id,
      timeout: 30_000,
    });

    expect(cancelled).toBeDefined();
    expect(cancelled.id).toBe(created.id);
  });

  test("deleteResponse works on a newly created response", async () => {
    const a = createAdapter().route({ provider: "openai" }, autoProvider);

    const created = await a.createResponse({
      model,
      input: "Reply with: pong",
      timeout: 30_000,
    });
    expect(created.id).toBeString();

    const deleted = await a.deleteResponse({
      model,
      response_id: created.id,
      timeout: 30_000,
    });

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(created.id);
  });
});

if (!canRun) {
  const reasons: string[] = [];
  if (!apiKey) reasons.push("OPENAI_API_KEY");
  console.info(`[live-test skipped] Missing: ${reasons.join(", ")}`);
}

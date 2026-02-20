/// <reference path="../bun-test.d.ts" />

import { describe, expect, test } from "bun:test";
import { autoLoader } from "../../src/core/auto-loader";
import {
  matchCondition,
  matchPattern,
  parseModelId,
  resolveFromRouteChain,
} from "../../src/core/router";
import {
  InvalidModelError,
  NoProviderError,
  UnsupportedApiError,
} from "../../src/errors";
import type { AdapterContext } from "../../src/types/core";
import type { ApiHandler, Provider } from "../../src/types/provider";
import type { RouteEntry } from "../../src/types/route";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeHandler(name = "test"): ApiHandler {
  return {
    getRequestConfig: (ctx) => ({
      url: `https://api.test.com/${name}`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ctx.model }),
    }),
    responseTransformers: [
      async (ctx) => {
        const raw = ctx.response.raw;
        if (!raw) throw new Error("response.raw missing in test handler");
        ctx.response.data = await raw.json();
      },
    ],
  };
}

function makeProvider(
  name: string,
  opts: { handler?: ApiHandler | null } = {},
): Provider {
  const handler = opts.handler === undefined ? makeHandler(name) : opts.handler;
  return {
    name,
    getHandler: () => handler,
  };
}

function makeCtx(overrides: Partial<AdapterContext> = {}): AdapterContext {
  const baseModelId =
    overrides.modelId !== undefined ? overrides.modelId : "openai/gpt-4";
  const parsed = parseModelId(baseModelId);
  return {
    apiType: "completion",
    config: {},
    request: { url: "" },
    response: {},
    state: {},
    modelId: parsed.modelId,
    providerKey: parsed.providerKey,
    model: parsed.model,
    normModel: parsed.normModel,
    normProvider: parsed.normProvider,
    normModelId: parsed.normModelId,
    ...overrides,
  };
}

async function withPatchedAutoLoader<T>(
  impl: (ctx: AdapterContext) => Provider | null | Promise<Provider | null>,
  fn: () => Promise<T>,
): Promise<T> {
  const loader = autoLoader as unknown as {
    resolve: (ctx: AdapterContext) => Promise<Provider | null>;
  };
  const originalResolve = loader.resolve;
  loader.resolve = (async (ctx) => impl(ctx)) as typeof loader.resolve;
  try {
    return await fn();
  } finally {
    loader.resolve = originalResolve;
  }
}

// ─── parseModelId ──────────────────────────────────────────────────────────

describe("parseModelId", () => {
  test("parses prefixed model string", () => {
    const result = parseModelId("openai/gpt-4");
    expect(result).toEqual({
      modelId: "openai/gpt-4",
      providerKey: "openai",
      model: "gpt-4",
      normProvider: "openai",
      normModel: "gpt-4",
      normModelId: "openai/gpt-4",
    });
  });

  test("parses non-prefixed model string", () => {
    const result = parseModelId("gpt-4");
    expect(result).toEqual({
      modelId: "openai/gpt-4",
      providerKey: "openai",
      model: "gpt-4",
      normProvider: "openai",
      normModel: "gpt-4",
      normModelId: "openai/gpt-4",
    });
  });

  test("handles model with multiple slashes", () => {
    const result = parseModelId("azure/openai/gpt-4");
    expect(result).toEqual({
      modelId: "azure/openai/gpt-4",
      providerKey: "azure",
      model: "openai/gpt-4",
      normProvider: "azure",
      normModel: "openai/gpt-4",
      normModelId: "azure/openai/gpt-4",
    });
  });

  test("throws error for model starting with /", () => {
    expect(() => parseModelId("/gpt-4")).toThrow(InvalidModelError);
    expect(() => parseModelId("/gpt-4")).toThrow(
      "provider component cannot be empty",
    );
  });

  test("throws error for model ending with /", () => {
    expect(() => parseModelId("openai/")).toThrow(InvalidModelError);
    expect(() => parseModelId("openai/")).toThrow(
      "model component cannot be empty",
    );
  });

  test("throws error for model with //", () => {
    expect(() => parseModelId("provider//model")).toThrow(InvalidModelError);
    expect(() => parseModelId("provider//model")).toThrow(
      "empty component found in model ID",
    );
  });

  test("throws error for empty string", () => {
    expect(() => parseModelId("")).toThrow(InvalidModelError);
    expect(() => parseModelId("")).toThrow("model ID cannot be empty");
  });

  test("preserves original casing while normalizing", () => {
    const result = parseModelId("OpenAI/GPT-4");
    expect(result).toEqual({
      modelId: "OpenAI/GPT-4",
      providerKey: "OpenAI",
      model: "GPT-4",
      normProvider: "openai",
      normModel: "gpt-4",
      normModelId: "openai/gpt-4",
    });
  });

  test("infers provider for bare model string", () => {
    const result = parseModelId("davinci-not-exists");
    expect(result).toEqual({
      modelId: "custom/davinci-not-exists",
      providerKey: "custom",
      model: "davinci-not-exists",
      normProvider: "custom",
      normModel: "davinci-not-exists",
      normModelId: "custom/davinci-not-exists",
    });
  });
});

// ─── matchPattern ──────────────────────────────────────────────────────────

describe("matchPattern", () => {
  test("string pattern is case-insensitive", () => {
    expect(matchPattern("gpt-4", "gpt-4")).toBe(true);
    expect(matchPattern("GPT-4", "gpt-4")).toBe(true);
    expect(matchPattern("gpt-4", "GPT-4")).toBe(true);
    expect(matchPattern("gpt-4", "GPT-4")).toBe(true);
  });

  test("RegExp is applied to the normalized value", () => {
    expect(matchPattern(/^gpt-/, "gpt-4")).toBe(true);
    expect(matchPattern(/^gpt-/, "GPT-4")).toBe(true);
    expect(matchPattern(/^claude-/, "claude-3")).toBe(true);
    expect(matchPattern(/^claude-/, "CLAUDE-3")).toBe(true);
  });

  test("array match uses OR semantics", () => {
    expect(matchPattern(["gpt-4", /^claude-/], "gpt-4")).toBe(true);
    expect(matchPattern(["gpt-4", /^claude-/], "claude-3")).toBe(true);
    expect(matchPattern(["gpt-4", /^claude-/], "mistral-7b")).toBe(false);
  });

  test("function pattern receives normalized value", () => {
    const seen: string[] = [];
    const fn = (v: string) => {
      seen.push(v);
      return v.startsWith("custom-");
    };
    expect(matchPattern(fn, "custom-model")).toBe(true);
    expect(matchPattern(fn, "gpt-4")).toBe(false);
    expect(matchPattern(fn, "CUSTOM-MODEL")).toBe(true);
    expect(seen).toEqual(["custom-model", "gpt-4", "custom-model"]);
  });

  test("empty array never matches", () => {
    expect(matchPattern([], "anything")).toBe(false);
  });
});

// ─── matchCondition ────────────────────────────────────────────────────────

describe("matchCondition", () => {
  describe("modelId condition", () => {
    test("exact match on full model string", () => {
      const ctx = makeCtx({ modelId: "openai/gpt-4" });
      expect(matchCondition({ modelId: "openai/gpt-4" }, ctx)).toBe(true);
      expect(matchCondition({ modelId: "openai/gpt-3" }, ctx)).toBe(false);
    });

    test("regex match on full model string", () => {
      const ctx = makeCtx({ modelId: "openai/gpt-4" });
      expect(matchCondition({ modelId: /^openai\// }, ctx)).toBe(true);
      expect(matchCondition({ modelId: /^anthropic\// }, ctx)).toBe(false);
    });
  });

  describe("model condition", () => {
    test("exact match on stripped model name", () => {
      const ctx = makeCtx({ modelId: "openai/gpt-4" });
      expect(matchCondition({ model: "gpt-4" }, ctx)).toBe(true);
      expect(matchCondition({ model: "gpt-3" }, ctx)).toBe(false);
    });

    test("regex match on stripped model name", () => {
      const ctx = makeCtx({ modelId: "openai/gpt-4" });
      expect(matchCondition({ model: /^gpt-/ }, ctx)).toBe(true);
      expect(matchCondition({ model: /^claude-/ }, ctx)).toBe(false);
    });
  });

  describe("provider condition", () => {
    test("matches provider prefix", () => {
      const ctx = makeCtx({ modelId: "openai/gpt-4" });
      expect(matchCondition({ provider: "openai" }, ctx)).toBe(true);
      expect(matchCondition({ provider: "anthropic" }, ctx)).toBe(false);
    });

    test("matches provider prefix from array", () => {
      const ctx = makeCtx({ modelId: "openai/gpt-4" });
      expect(matchCondition({ provider: ["openai", "azure"] }, ctx)).toBe(true);
      expect(matchCondition({ provider: ["anthropic", "google"] }, ctx)).toBe(
        false,
      );
    });
  });

  describe("empty or invalid condition", () => {
    test("returns false for empty condition object", () => {
      const ctx = makeCtx({ modelId: "openai/gpt-4" });
      expect(matchCondition({ model: "not-exists" }, ctx)).toBe(false);
    });

    test("returns false for condition with unrecognized keys", () => {
      const ctx = makeCtx({ modelId: "openai/gpt-4" });
      expect(matchCondition({ unknown: "value" } as any, ctx)).toBe(false);
    });
  });
});

// ─── resolveFromRouteChain ─────────────────────────────────────────────────

describe("resolveFromRouteChain", () => {
  test("condition route: matches and sets provider + handler", async () => {
    const prov = makeProvider("openai");
    const entries: RouteEntry[] = [
      { type: "condition", condition: { model: /^gpt-/ }, provider: prov },
    ];
    const ctx = makeCtx({ modelId: "openai/gpt-4" });

    await resolveFromRouteChain(ctx, entries);

    expect(ctx.provider).toBe(prov);
    expect(ctx.handler).toBeDefined();
  });

  test("condition route: skips non-matching entries", async () => {
    const openai = makeProvider("openai");
    const anthropic = makeProvider("anthropic");
    const entries: RouteEntry[] = [
      { type: "condition", condition: { model: /^gpt-/ }, provider: openai },
      {
        type: "condition",
        condition: { model: /^claude-/ },
        provider: anthropic,
      },
    ];
    const ctx = makeCtx({ modelId: "custom/claude-3" });

    await resolveFromRouteChain(ctx, entries);

    expect(ctx.provider).toBe(anthropic);
  });

  test("condition route: getHandler returns null -> throws UnsupportedApiError", async () => {
    const prov = makeProvider("openai", { handler: null });
    const entries: RouteEntry[] = [
      { type: "condition", condition: { model: "gpt-4" }, provider: prov },
    ];
    const ctx = makeCtx({ modelId: "openai/gpt-4" });

    await expect(resolveFromRouteChain(ctx, entries)).rejects.toBeInstanceOf(
      UnsupportedApiError,
    );
  });

  test("resolver route: returns provider -> committed", async () => {
    const prov = makeProvider("custom");
    const entries: RouteEntry[] = [{ type: "resolver", resolver: () => prov }];
    const ctx = makeCtx({ modelId: "custom/gpt-4" });

    await resolveFromRouteChain(ctx, entries);

    expect(ctx.provider).toBe(prov);
  });

  test("resolver route: returns null -> skips to next", async () => {
    const prov = makeProvider("openai");
    const entries: RouteEntry[] = [
      { type: "resolver", resolver: () => null },
      { type: "condition", condition: { model: "gpt-4" }, provider: prov },
    ];
    const ctx = makeCtx({ modelId: "openai/gpt-4" });

    await resolveFromRouteChain(ctx, entries);

    expect(ctx.provider).toBe(prov);
  });

  test("resolver route: returns undefined -> skips to next", async () => {
    const prov = makeProvider("openai");
    const entries: RouteEntry[] = [
      { type: "resolver", resolver: () => undefined },
      { type: "condition", condition: { model: "gpt-4" }, provider: prov },
    ];
    const ctx = makeCtx({ modelId: "openai/gpt-4" });

    await resolveFromRouteChain(ctx, entries);

    expect(ctx.provider).toBe(prov);
  });

  test("resolver route: returned provider getHandler returns null -> UnsupportedApiError", async () => {
    const prov = makeProvider("openai", { handler: null });
    const entries: RouteEntry[] = [{ type: "resolver", resolver: () => prov }];
    const ctx = makeCtx({ modelId: "openai/gpt-4" });

    await expect(resolveFromRouteChain(ctx, entries)).rejects.toBeInstanceOf(
      UnsupportedApiError,
    );
  });

  test("no match -> throws NoProviderError", async () => {
    const entries: RouteEntry[] = [
      {
        type: "condition",
        condition: { model: /^claude-/ },
        provider: makeProvider("anthropic"),
      },
    ];
    const ctx = makeCtx({ modelId: "openai/gpt-4" });

    await expect(resolveFromRouteChain(ctx, entries)).rejects.toBeInstanceOf(
      NoProviderError,
    );
  });

  test("route chain respects registration order (first match wins)", async () => {
    const first = makeProvider("first");
    const second = makeProvider("second");
    const entries: RouteEntry[] = [
      { type: "condition", condition: { model: /^gpt-/ }, provider: first },
      { type: "condition", condition: { model: /^gpt-/ }, provider: second },
    ];
    const ctx = makeCtx({ modelId: "openai/gpt-4" });

    await resolveFromRouteChain(ctx, entries);

    expect(ctx.provider).toBe(first);
  });

  test("auto entry resolves successfully via autoLoader", async () => {
    const handler = makeHandler("auto-resolved");
    const autoProvider = makeProvider("auto", { handler });
    const entries: RouteEntry[] = [{ type: "auto" }];
    const ctx = makeCtx({ modelId: "myprefix/model-x" });

    await withPatchedAutoLoader(
      async () => autoProvider,
      async () => {
        await resolveFromRouteChain(ctx, entries);
      },
    );

    expect(ctx.provider).toBe(autoProvider);
    expect(ctx.handler).toBe(handler);
  });

  test("auto entry returns null → continues to next entry", async () => {
    const fallback = makeProvider("fallback");
    const entries: RouteEntry[] = [
      { type: "auto" },
      { type: "condition", condition: { model: /.*/ }, provider: fallback },
    ];
    const ctx = makeCtx({ modelId: "gpt-4" });

    await withPatchedAutoLoader(
      async () => null,
      async () => {
        await resolveFromRouteChain(ctx, entries);
      },
    );

    expect(ctx.provider).toBe(fallback);
  });

  test("auto entry provides provider but handler incompatible -> UnsupportedApiError", async () => {
    const incompatible = makeProvider("auto", { handler: null });
    const entries: RouteEntry[] = [{ type: "auto" }];
    const ctx = makeCtx({ modelId: "auto/model" });

    await expect(
      withPatchedAutoLoader(
        async () => incompatible,
        async () => resolveFromRouteChain(ctx, entries),
      ),
    ).rejects.toBeInstanceOf(UnsupportedApiError);
  });

  test("mixed entry types in chain: condition → resolver → auto", async () => {
    const condProvider = makeProvider("cond");
    const resolverProvider = makeProvider("resolver");

    const entries: RouteEntry[] = [
      {
        type: "condition",
        condition: { model: /^claude-/ },
        provider: condProvider,
      },
      {
        type: "resolver",
        resolver: (ctx) => (ctx.model === "custom" ? resolverProvider : null),
      },
      { type: "auto" },
    ];

    const ctx1 = makeCtx({
      modelId: "custom/claude-3",
    });
    await resolveFromRouteChain(ctx1, entries);
    expect(ctx1.provider).toBe(condProvider);

    const ctx2 = makeCtx({
      modelId: "custom/custom",
    });
    await resolveFromRouteChain(ctx2, entries);
    expect(ctx2.provider).toBe(resolverProvider);

    const ctx3 = makeCtx({ modelId: "custom/unknown" });
    await expect(
      withPatchedAutoLoader(
        async () => null,
        async () => resolveFromRouteChain(ctx3, entries),
      ),
    ).rejects.toBeInstanceOf(NoProviderError);
  });

  test("NoProviderError contains the modelId", async () => {
    const ctx = makeCtx({ modelId: "openai/gpt-4" });
    try {
      await resolveFromRouteChain(ctx, []);
    } catch (err) {
      expect(err).toBeInstanceOf(NoProviderError);
      expect((err as NoProviderError).model).toBe("openai/gpt-4");
    }
  });

  test("NoProviderError falls back to ctx.model when modelId missing", async () => {
    const ctx = makeCtx({ modelId: "gpt-4" });
    ctx.modelId = undefined as unknown as string;
    try {
      await resolveFromRouteChain(ctx, []);
    } catch (err) {
      expect(err).toBeInstanceOf(NoProviderError);
      expect((err as NoProviderError).model).toBe("gpt-4");
    }
  });

  test("NoProviderError falls back to 'unknown' when no identifiers available", async () => {
    const ctx = makeCtx({ modelId: "gpt-4" });
    ctx.modelId = undefined as unknown as string;
    ctx.model = undefined as unknown as string;
    await expect(resolveFromRouteChain(ctx, [])).rejects.toMatchObject({
      model: "unknown",
    });
  });

  test("handles unknown entry type by skipping it", async () => {
    const fallback = makeProvider("fallback");
    const entries: RouteEntry[] = [
      {
        type: "unknown" as any,
        condition: { model: "test" },
        provider: makeProvider("unknown"),
      },
      { type: "condition", condition: { model: "gpt-4" }, provider: fallback },
    ];
    const ctx = makeCtx({ modelId: "openai/gpt-4" });

    await resolveFromRouteChain(ctx, entries);

    expect(ctx.provider).toBe(fallback);
  });
});

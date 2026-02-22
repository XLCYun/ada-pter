/// <reference path="../bun-test.d.ts" />
import { describe, expect, mock, test } from "bun:test";
import { AutoLoader } from "../../src/core/auto-loader";
import type { AdapterContext } from "../../src/types/core";
import type { ApiHandler, Provider } from "../../src/types/provider";

type ImporterResult = { autoProvider?: Provider };
type Importer = (packageName: string) => Promise<ImporterResult>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeHandler(): ApiHandler {
  return {
    getRequestConfig: () => ({
      url: "https://api.test.com/v1",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }),
    responseTransformers: [
      async (ctx) => {
        ctx.response.data = await ctx.response.raw!.json();
      },
    ],
  };
}

function makeCtx(overrides: Partial<AdapterContext> = {}): AdapterContext {
  return {
    apiType: "completion",
    modelId: "openai/gpt-4",
    providerKey: "openai",
    model: "gpt-4",
    normModel: "gpt-4",
    normProvider: "openai",
    normModelId: "openai/gpt-4",
    request: {} as never,
    response: {},
    config: {},
    state: {},
    ...overrides,
  };
}

function makeProvider(
  name: string,
  handler: ApiHandler = makeHandler(),
): Provider {
  return {
    name,
    getHandler: () => handler,
  };
}

function createImporter(
  implementation: (
    packageName: string,
  ) => ImporterResult | Promise<ImporterResult>,
) {
  const calls: string[] = [];
  const importer: Importer = async (packageName) => {
    calls.push(packageName);
    return implementation(packageName);
  };
  return { importer, calls };
}

// ─── AutoLoader.resolve ────────────────────────────────────────────────────

describe("AutoLoader provider resolution edge cases", () => {
  test("normalizes provider casing", async () => {
    const provider = makeProvider("MixedCase");
    const { importer } = createImporter(() => ({ autoProvider: provider }));
    const loader = new AutoLoader({ importer });
    const ctx = makeCtx({
      providerKey: "MixedCase",
      normProvider: "mixedcase",
    });

    const result = await loader.resolve(ctx);
    expect(result).toBe(provider);
  });

  test("returns null when context is missing normProvider", async () => {
    const loader = new AutoLoader();
    const ctx = makeCtx({ normProvider: "" });
    const result = await loader.resolve(ctx);
    expect(result).toBeNull();
  });

  test("propagates null when importer resolves undefined autoProvider", async () => {
    const ctx = makeCtx({ providerKey: "ghost", normProvider: "ghost" });
    const { importer, calls } = createImporter(async () => ({}));
    const loader = new AutoLoader({ importer });

    const result = await loader.resolve(ctx);
    expect(result).toBeNull();
    expect(calls).toEqual(["@ada-pter/ghost"]);
  });
});

describe("AutoLoader.resolve", () => {
  test("returns null when no provider prefix (cannot infer)", async () => {
    const loader = new AutoLoader();
    const ctx = makeCtx({
      normProvider: "",
      providerKey: "", // simulate missing provider key
      model: "gpt-4",
    });

    const result = await loader.resolve(ctx);
    expect(result).toBeNull();
  });
});

describe("AutoLoader dynamic import behavior", () => {
  test("returns null when dynamic import fails (package not installed)", async () => {
    const ctx = makeCtx({
      providerKey: "nonexistent-provider-xyz",
      normProvider: "nonexistent-provider-xyz",
      model: "some-model",
    });
    const { importer, calls } = createImporter(async () => {
      throw new Error("missing module");
    });
    const loader = new AutoLoader({ importer });

    const result = await loader.resolve(ctx);
    expect(result).toBeNull();
    expect(calls).toEqual(["@ada-pter/nonexistent-provider-xyz"]);

    const secondResult = await loader.resolve(ctx);
    expect(secondResult).toBeNull();
    expect(calls).toHaveLength(1);
  });

  test("records failed imports when module lacks autoProvider", async () => {
    const ctx = makeCtx({ providerKey: "ghost", normProvider: "ghost" });
    let importerCalls = 0;
    const loader = new AutoLoader({
      importer: async () => {
        importerCalls += 1;
        return {};
      },
    });

    const result1 = await loader.resolve(ctx);
    expect(result1).toBeNull();
    expect(importerCalls).toBe(1);

    const result2 = await loader.resolve(ctx);
    expect(result2).toBeNull();
    expect(importerCalls).toBe(1);
  });

  test("successfully loads provider module and caches importer result", async () => {
    const handler = makeHandler();
    const provider = makeProvider("openai", handler);
    const ctx = makeCtx({ providerKey: "openai", normProvider: "openai" });
    const { importer, calls } = createImporter(() => ({
      autoProvider: provider,
    }));
    const loader = new AutoLoader({ importer });

    const first = await loader.resolve(ctx);
    const second = await loader.resolve(ctx);

    expect(first).toBe(provider);
    expect(second).toBe(provider);
    expect(calls).toEqual(["@ada-pter/openai"]);
  });

  test("maps 'custom' provider to openai before importing", async () => {
    const provider = makeProvider("openai");
    const ctx = makeCtx({ providerKey: "custom", normProvider: "custom" });
    const { importer, calls } = createImporter((pkg) => ({
      autoProvider: pkg === "@ada-pter/openai" ? provider : undefined,
    }));
    const loader = new AutoLoader({ importer });

    const result = await loader.resolve(ctx);
    expect(result).toBe(provider);
    expect(calls).toEqual(["@ada-pter/openai"]);
  });

  test("uses default importer when importer option is omitted", async () => {
    const provider = makeProvider("fake");
    const bunMock = mock as unknown as {
      module: (name: string, factory: () => ImporterResult) => void;
    };
    bunMock.module("@ada-pter/fake", () => ({ autoProvider: provider }));
    const loader = new AutoLoader();
    const ctx = makeCtx({ providerKey: "fake", normProvider: "fake" });

    const result = await loader.resolve(ctx);
    expect(result).toBe(provider);
  });
});

describe("AutoLoader provider compatibility", () => {
  test("returns provider when getHandler succeeds", async () => {
    const loader = new AutoLoader();
    const handler = makeHandler();
    const provider: Provider = {
      name: "test",
      getHandler: () => handler,
    };

    (loader as unknown as { loaded: Map<string, Provider> }).loaded.set(
      "test",
      provider,
    );

    const ctx = makeCtx({
      providerKey: "test",
      normProvider: "test",
      model: "gpt-4",
    });

    const result = await loader.resolve(ctx);
    expect(result).toBe(provider);
  });

  test("returns null when getHandler returns null (incompatible)", async () => {
    const loader = new AutoLoader();
    const provider: Provider = {
      name: "test",
      getHandler: () => null, // cannot handle
    };

    (loader as unknown as { loaded: Map<string, Provider> }).loaded.set(
      "test",
      provider,
    );

    const ctx = makeCtx({
      providerKey: "test",
      normProvider: "test",
      model: "some-model",
    });

    const result = await loader.resolve(ctx);
    expect(result).toBeNull();
  });

  test("caches loaded providers (second call uses cache)", async () => {
    const loader = new AutoLoader();
    const handler = makeHandler();
    const provider: Provider = {
      name: "cached",
      getHandler: () => handler,
    };

    // First call: manually put in cache
    (loader as unknown as { loaded: Map<string, Provider> }).loaded.set(
      "cached",
      provider,
    );

    const ctx1 = makeCtx({
      providerKey: "cached",
      normProvider: "cached",
      model: "model-1",
    });
    const result1 = await loader.resolve(ctx1);
    expect(result1).not.toBeNull();

    // Second call: same provider name, should use cache
    const ctx2 = makeCtx({
      providerKey: "cached",
      normProvider: "cached",
      model: "model-2",
    });
    const result2 = await loader.resolve(ctx2);
    expect(result2).not.toBeNull();
    expect(result2).toBe(result1);
  });

  test("getHandler receives the full context", async () => {
    const loader = new AutoLoader();
    let receivedCtx: AdapterContext | undefined;
    const provider: Provider = {
      name: "ctx-check",
      getHandler: (ctx) => {
        receivedCtx = ctx;
        return makeHandler();
      },
    };

    (loader as unknown as { loaded: Map<string, Provider> }).loaded.set(
      "ctx-check",
      provider,
    );

    const ctx = makeCtx({
      providerKey: "ctx-check",
      normProvider: "ctx-check",
      model: "test-model",
      apiType: "embedding",
    });
    await loader.resolve(ctx);

    expect(receivedCtx).toBeDefined();
    if (!receivedCtx) throw new Error("expected getHandler to receive ctx");
    expect(receivedCtx.apiType).toBe("embedding");
    expect(receivedCtx.model).toBe("test-model");
  });

  test("getHandler exceptions bubble up to callers", async () => {
    const provider: Provider = {
      name: "boom",
      getHandler: () => {
        throw new Error("boom");
      },
    };
    const loader = new AutoLoader();
    (loader as unknown as { loaded: Map<string, Provider> }).loaded.set(
      "boom",
      provider,
    );

    await expect(
      loader.resolve(
        makeCtx({ providerKey: "boom", normProvider: "boom", model: "test" }),
      ),
    ).rejects.toThrow("boom");
  });
});

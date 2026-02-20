import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  resolveApiBase,
  resolveApiKey,
  resolveApiPath,
} from "../../src/helpers/resolver";
import type { AdapterContext } from "../../src/types";

const createMockCtx = (
  config: Partial<AdapterContext["config"]> = {},
): AdapterContext =>
  ({
    config,
    apiType: "completion",
    modelId: "test/model",
    providerKey: "test",
    model: "model",
    normModel: "model",
    normProvider: "test",
    normModelId: "test/model",
    request: { url: "" },
    response: {},
    state: {},
  }) as AdapterContext;

describe("resolveApiKey", () => {
  const ENV_KEY = "TEST_API_KEY_RESOLVER";

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  test("returns ctx.config.apiKey when it is a string", () => {
    const ctx = createMockCtx({ apiKey: "ctx-key" });
    expect(resolveApiKey(ctx)).toBe("ctx-key");
  });

  test("returns ctx.config.apiKey when it is a function", () => {
    const ctx = createMockCtx({ apiKey: () => "fn-key" });
    expect(resolveApiKey(ctx)).toBe("fn-key");
  });

  test("falls back to env when ctx.config.apiKey is undefined", () => {
    process.env[ENV_KEY] = "env-key";
    const ctx = createMockCtx();
    expect(resolveApiKey(ctx, { envName: ENV_KEY })).toBe("env-key");
  });

  test("ctx.config.apiKey takes priority over env", () => {
    process.env[ENV_KEY] = "env-key";
    const ctx = createMockCtx({ apiKey: "ctx-key" });
    expect(resolveApiKey(ctx, { envName: ENV_KEY })).toBe("ctx-key");
  });

  test("returns undefined when no source provides a value", () => {
    const ctx = createMockCtx();
    expect(resolveApiKey(ctx)).toBeUndefined();
  });
});

describe("resolveApiBase", () => {
  const ENV_KEY = "TEST_API_BASE_RESOLVER";

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  test("returns ctx.config.apiBase when it is a string", () => {
    const ctx = createMockCtx({ apiBase: "https://ctx.api" });
    expect(resolveApiBase(ctx)).toBe("https://ctx.api");
  });

  test("returns ctx.config.apiBase when it is a function", () => {
    const ctx = createMockCtx({ apiBase: () => "https://fn.api" });
    expect(resolveApiBase(ctx)).toBe("https://fn.api");
  });

  test("falls back to env when ctx.config.apiBase is undefined", () => {
    process.env[ENV_KEY] = "https://env.api";
    const ctx = createMockCtx();
    expect(resolveApiBase(ctx, { envName: ENV_KEY })).toBe("https://env.api");
  });

  test("falls back to default when ctx and env are undefined", () => {
    const ctx = createMockCtx();
    expect(resolveApiBase(ctx, { default: "https://default.api" })).toBe(
      "https://default.api",
    );
  });

  test("ctx.config.apiBase takes priority over env and default", () => {
    process.env[ENV_KEY] = "https://env.api";
    const ctx = createMockCtx({ apiBase: "https://ctx.api" });
    expect(
      resolveApiBase(ctx, { envName: ENV_KEY, default: "https://default.api" }),
    ).toBe("https://ctx.api");
  });

  test("returns undefined when no source provides a value", () => {
    const ctx = createMockCtx();
    expect(resolveApiBase(ctx)).toBeUndefined();
  });
});

describe("resolveApiPath", () => {
  test("returns ctx.config.apiPath when it is a string", () => {
    const ctx = createMockCtx({ apiPath: "/v1/chat" });
    expect(resolveApiPath(ctx)).toBe("/v1/chat");
  });

  test("returns ctx.config.apiPath when it is a function", () => {
    const ctx = createMockCtx({ apiPath: () => "/v2/chat" });
    expect(resolveApiPath(ctx)).toBe("/v2/chat");
  });

  test("falls back to default when ctx.config.apiPath is undefined", () => {
    const ctx = createMockCtx();
    expect(resolveApiPath(ctx, { default: "/default/path" })).toBe(
      "/default/path",
    );
  });

  test("ctx.config.apiPath takes priority over default", () => {
    const ctx = createMockCtx({ apiPath: "/ctx/path" });
    expect(resolveApiPath(ctx, { default: "/default/path" })).toBe("/ctx/path");
  });

  test("returns undefined when no source provides a value", () => {
    const ctx = createMockCtx();
    expect(resolveApiPath(ctx)).toBeUndefined();
  });
});

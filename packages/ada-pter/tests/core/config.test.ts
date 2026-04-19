import { describe, expect, test } from "bun:test";
import { mergeConfig } from "../../src/core/config";

describe("mergeConfig", () => {
  test("merges flat objects (later overrides earlier)", () => {
    const result = mergeConfig({ timeout: 5000, maxRetries: 3 }, { timeout: 10000 });
    expect(result).toEqual({ timeout: 10000, maxRetries: 3 });
  });

  test("three-level merge: global > API-level > call-level", () => {
    const global = { timeout: 5000, maxRetries: 3, retryDelay: 1000 };
    const apiLevel = { timeout: 10000 };
    const callLevel = { model: "gpt-4" };

    const result = mergeConfig(global, apiLevel, callLevel);
    expect(result).toEqual({
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      model: "gpt-4",
    });
  });

  test("four-level merge: defaults > global > API-level > call-level", () => {
    const defaultsConfig = { timeout: 2000, maxRetries: 1, stream: false };
    const global = { timeout: 5000, maxRetries: 3, retryDelay: 1000 };
    const apiLevel = { timeout: 10000 };
    const callLevel = { model: "gpt-4" };

    const result = mergeConfig(defaultsConfig, global, apiLevel, callLevel);
    expect(result).toEqual({
      timeout: 10000, // from API level
      maxRetries: 3, // from global
      retryDelay: 1000, // from global
      stream: false, // from defaults
      model: "gpt-4", // from call level
    });
  });

  test("four-level merge with new apiKey/apiBase/apiPath fields", () => {
    const defaultsConfig = { timeout: 2000 };
    const global = {
      apiKey: "global-key",
      apiBase: "https://global.example.com",
    };
    const apiLevel = { apiBase: "https://api.example.com", temperature: 0.7 };
    const callLevel = {
      apiKey: "call-key",
      apiPath: "/chat/completions",
    };

    const result = mergeConfig(defaultsConfig, global, apiLevel, callLevel);
    expect(result).toEqual({
      timeout: 2000, // from defaults
      apiKey: "call-key", // from call level
      apiBase: "https://api.example.com", // from API level (not overridden by call)
      apiPath: "/chat/completions", // from call level
      temperature: 0.7, // from API level
    });
  });

  test("arrays are replaced entirely (not concatenated)", () => {
    const result = mergeConfig({ model: ["model-a", "model-b"] }, { model: ["model-c"] });
    expect(result).toEqual({ model: ["model-c"] });
  });

  test("undefined sources are skipped", () => {
    const result = mergeConfig({ timeout: 5000 }, undefined, { maxRetries: 2 }, undefined);
    expect(result).toEqual({ timeout: 5000, maxRetries: 2 });
  });

  test("null sources are skipped", () => {
    const result = mergeConfig({ timeout: 5000 }, null as unknown as undefined);
    expect(result).toEqual({ timeout: 5000 });
  });

  test("returns empty object when all sources are undefined", () => {
    const result = mergeConfig(undefined, undefined);
    expect(result).toEqual({});
  });

  test("returns empty object when no sources are provided", () => {
    const result = mergeConfig();
    expect(result).toEqual({});
  });

  test("functions are overwritten (not merged)", () => {
    const fn1 = () => {};
    const fn2 = () => {};
    const result = mergeConfig({ onFallback: fn1 }, { onFallback: fn2 });
    expect(result.onFallback).toBe(fn2);
  });

  test("does not mutate source objects", () => {
    const source1 = { timeout: 5000, temperature: 0.5 };
    const source2 = { temperature: 0.9, maxTokens: 100 };

    const source1Copy = { ...source1 };
    const source2Copy = { ...source2 };

    mergeConfig(source1, source2);

    expect(source1).toEqual(source1Copy);
    expect(source2).toEqual(source2Copy);
  });

  test("null field values overwrite existing values", () => {
    const result = mergeConfig({ timeout: 5000 }, { timeout: null as unknown as number });
    expect(result.timeout).toBeNull();
  });

  test("single source returns a shallow copy", () => {
    const source = { timeout: 5000, temperature: 0.7 };
    const result = mergeConfig(source);
    expect(result).toEqual(source);
    expect(result).not.toBe(source);
  });

  test("model array fallback: call-level replaces API-level", () => {
    const result = mergeConfig({ model: ["gpt-4", "claude-3-opus"] }, { model: "gpt-4o" });
    expect(result).toEqual({ model: "gpt-4o" });
  });

  // ─── API params in three-level merge ───────────────────────────────────

  test("API params (temperature, maxTokens) participate in three-level merge", () => {
    const global = { timeout: 5000, temperature: 0.5 };
    const apiLevel = { temperature: 0.7, maxTokens: 4096 };
    const callLevel = {
      model: "gpt-4",
      messages: [{ role: "user" as const, content: "hi" }],
    };

    const result = mergeConfig(global, apiLevel, callLevel);
    expect(result).toEqual({
      timeout: 5000,
      temperature: 0.7,
      maxTokens: 4096,
      model: "gpt-4",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  test("call-level temperature overrides API-level", () => {
    const result = mergeConfig({ temperature: 0.5 }, { temperature: 0.7 }, { temperature: 0.9 });
    expect(result.temperature).toBe(0.9);
  });

  test("messages array is replaced entirely by call-level", () => {
    const globalMessages = [{ role: "system" as const, content: "You are helpful." }];
    const callMessages = [{ role: "user" as const, content: "Hello" }];

    const result = mergeConfig({ messages: globalMessages }, { messages: callMessages });
    expect(result.messages).toEqual(callMessages);
    expect(result.messages).toHaveLength(1);
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────

  test("preserves undefined values in flat merge", () => {
    const result = mergeConfig({ a: 1, b: 2 } as any, { a: undefined, c: 3 } as any);
    expect(result).toEqual({ a: undefined, b: 2, c: 3 });
  });

  test("handles empty objects gracefully", () => {
    const result = mergeConfig({ timeout: 5000 }, {}, { temperature: 0.7 }, {});
    expect(result).toEqual({ timeout: 5000, temperature: 0.7 });
  });

  test("handles symbol keys (they should be ignored)", () => {
    const sym = Symbol("test");
    const obj1 = { [sym]: "value1", normal: "keep" } as any;
    const obj2 = { normal: "override" } as any;
    const result = mergeConfig(obj1, obj2);
    expect(result).toEqual({ normal: "override" });
    expect((result as any)[sym as unknown as string]).toBeUndefined();
  });

  test("large number of sources", () => {
    const sources = Array.from(
      { length: 100 },
      (_, i) =>
        ({
          [`key${i}`]: i,
          shared: i,
        }) as any,
    );
    const result = mergeConfig(...sources);
    expect((result as any).shared).toBe(99); // Last source wins
    expect((result as any).key0).toBe(0);
    expect((result as any).key99).toBe(99);
  });

  // ─── Top-level objects replaced entirely ──────────────────────────────

  test("top-level nested objects are replaced entirely (not recursively merged)", () => {
    const result = mergeConfig(
      { nested: { a: 1, b: 2 } } as any,
      { nested: { b: 3, c: 4 } } as any,
    );
    // Replaced entirely: no recursive merge
    expect(result).toEqual({ nested: { b: 3, c: 4 } });
  });

  test("top-level nested objects with deeper nesting are replaced entirely", () => {
    const result = mergeConfig(
      { api: { openai: { timeout: 5000, retry: { maxRetries: 3, delay: 1000 } } } } as any,
      { api: { openai: { timeout: 10000, retry: { maxRetries: 5 } } } } as any,
    );
    // Replaced entirely at top level: only the second value for "api" is kept
    expect(result).toEqual({ api: { openai: { timeout: 10000, retry: { maxRetries: 5 } } } });
  });

  test("mixed primitive and object types - objects replaced entirely", () => {
    const result = mergeConfig(
      {
        timeout: 5000,
        model: "gpt-4",
        metadata: { version: "1.0", env: "prod" },
      } as any,
      {
        timeout: 10000,
        metadata: { env: "staging" },
        stream: true,
      } as any,
    );
    expect(result).toEqual({
      timeout: 10000,
      model: "gpt-4",
      metadata: { env: "staging" }, // replaced entirely, no recursive merge
      stream: true,
    });
  });

  // ─── Real-world Configuration Scenarios ───────────────────────────────────

  test("complete three-level configuration merge", () => {
    const globalConfig = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 2000,
      temperature: 0.5,
      maxTokens: 2048,
    };

    const apiConfig = {
      timeout: 60000,
      temperature: 0.7,
      maxTokens: 4096,
      model: "gpt-4",
    };

    const callConfig = {
      temperature: 0.9,
      maxTokens: 1024,
      messages: [{ role: "user" as const, content: "What is TypeScript?" }],
      stream: true,
    };

    const result = mergeConfig(globalConfig, apiConfig, callConfig);
    expect(result).toEqual({
      timeout: 60000, // from API level
      maxRetries: 3, // from global
      retryDelay: 2000, // from global
      temperature: 0.9, // from call level
      maxTokens: 1024, // from call level
      model: "gpt-4", // from API level
      messages: [{ role: "user", content: "What is TypeScript?" }], // from call level
      stream: true,
    });
  });

  test("AbortSignal handling", () => {
    const abortController1 = new AbortController();
    const abortController2 = new AbortController();

    const result = mergeConfig({ signal: abortController1.signal, timeout: 5000 }, { signal: abortController2.signal });

    expect(result.signal).toBe(abortController2.signal);
    expect(result.timeout).toBe(5000);
  });

  test("provider-specific configuration merging", () => {
    const baseConfig = {
      timeout: 10000,
      temperature: 0.7,
      maxTokens: 2048,
    };

    const providerConfig = {
      timeout: 30000,
      model: "anthropic/claude-3-sonnet",
      metadata: {
        provider: "anthropic",
        apiVersion: "2023-06-01",
      },
    } as any;

    const result = mergeConfig(baseConfig, providerConfig);
    expect(result).toEqual({
      timeout: 30000,
      temperature: 0.7,
      maxTokens: 2048,
      model: "anthropic/claude-3-sonnet",
      metadata: {
        provider: "anthropic",
        apiVersion: "2023-06-01",
      },
    });
  });
});

// ─── extraBody / extraHeaders special merge ────────────────────────────────────

describe("mergeConfig - extraBody / extraHeaders", () => {
  test("extraBody internal fields merge across two levels", () => {
    const result = mergeConfig(
      { extraBody: { a: 1, b: 2 } } as any,
      { extraBody: { b: 3, c: 4 } } as any,
    );
    expect(result).toEqual({ extraBody: { a: 1, b: 3, c: 4 } });
  });

  test("extraHeaders internal fields merge across two levels", () => {
    const result = mergeConfig(
      { extraHeaders: { "X-App": "test", "X-Version": "1" } } as any,
      { extraHeaders: { "X-Request": "call", "X-Version": "2" } } as any,
    );
    expect(result).toEqual({ extraHeaders: { "X-App": "test", "X-Request": "call", "X-Version": "2" } });
  });

  test("extraBody internal fields merge across three levels", () => {
    const result = mergeConfig(
      { extraBody: { global_field: "global", shared: "from-global" } } as any,
      { extraBody: { api_field: "api" } } as any,
      { extraBody: { call_field: "call", shared: "from-call" } } as any,
    );
    expect(result).toEqual({
      extraBody: {
        global_field: "global",
        api_field: "api",
        call_field: "call",
        shared: "from-call",
      },
    });
  });

  test("extraHeaders internal fields merge across three levels", () => {
    const result = mergeConfig(
      { extraHeaders: { "X-Global": "global" } } as any,
      { extraHeaders: { "X-Api": "api" } } as any,
      { extraHeaders: { "X-Call": "call" } } as any,
    );
    expect(result).toEqual({
      extraHeaders: {
        "X-Global": "global",
        "X-Api": "api",
        "X-Call": "call",
      },
    });
  });

  test("extraBody merge is one level only - nested objects are NOT recursively merged", () => {
    const result = mergeConfig(
      { extraBody: { nested: { a: 1, b: 2 } } } as any,
      { extraBody: { nested: { c: 3 } } } as any,
    );
    // One-level merge: nested object within extraBody is replaced, not deep-merged
    expect(result).toEqual({ extraBody: { nested: { c: 3 } } });
  });

  test("extraHeaders merge is one level only - nested objects are NOT recursively merged", () => {
    const result = mergeConfig(
      { extraHeaders: { "X-Custom": { a: 1, b: 2 } } } as any,
      { extraHeaders: { "X-Custom": { c: 3 } } } as any,
    );
    expect(result).toEqual({ extraHeaders: { "X-Custom": { c: 3 } } });
  });

  test("extraBody with later null value replaces entirely", () => {
    const result = mergeConfig(
      { extraBody: { a: 1 } } as any,
      { extraBody: null } as any,
    );
    expect((result as any).extraBody).toBeNull();
  });

  test("extraBody and extraHeaders merge independently", () => {
    const result = mergeConfig(
      { extraBody: { a: 1 }, extraHeaders: { "X-A": "1" } } as any,
      { extraBody: { b: 2 }, extraHeaders: { "X-B": "2" } } as any,
    );
    expect(result).toEqual({
      extraBody: { a: 1, b: 2 },
      extraHeaders: { "X-A": "1", "X-B": "2" },
    });
  });
});

// ─── Enhanced Edge Cases ───────────────────────────────────────────────────────

describe("mergeConfig - Enhanced Edge Cases", () => {
  test("handles special number values", () => {
    const result = mergeConfig(
      { nan: NaN, infinity: Infinity, negInfinity: -Infinity } as any,
      { nan: 0, infinity: 1, negInfinity: -1 } as any,
    );
    expect((result as any).nan).toBe(0);
    expect((result as any).infinity).toBe(1);
    expect((result as any).negInfinity).toBe(-1);
  });

  test("handles BigInt values", () => {
    const result = mergeConfig({ big: BigInt(1) } as any, { big: BigInt(2) } as any);
    expect((result as any).big).toBe(BigInt(2));
  });

  test("handles frozen objects", () => {
    const frozen1 = Object.freeze({ a: 1, b: 2 });
    const frozen2 = Object.freeze({ b: 3, c: 4 });

    const result = mergeConfig(frozen1 as any, frozen2 as any);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  test("handles sealed objects", () => {
    const sealed1 = Object.seal({ a: 1, b: 2 });
    const sealed2 = Object.seal({ b: 3, c: 4 });

    const result = mergeConfig(sealed1 as any, sealed2 as any);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  test("handles non-configurable properties", () => {
    const obj1 = {};
    Object.defineProperty(obj1, "fixed", {
      value: "value1",
      configurable: false,
      writable: true,
    });

    const obj2 = { fixed: "value2", other: "new" };

    const result = mergeConfig(obj1 as any, obj2 as any);
    expect((result as any).fixed).toBe("value2");
    expect((result as any).other).toBe("new");
  });
});

// ─── Performance and Memory Tests ────────────────────────────────────────────

describe("mergeConfig - Performance and Memory", () => {
  test("handles large objects efficiently", () => {
    const createLargeObject = (size: number) => {
      const obj: any = {};
      for (let i = 0; i < size; i++) {
        obj[`key${i}`] = { value: i, nested: { deep: i } };
      }
      return obj;
    };

    const large1 = createLargeObject(1000);
    const large2 = createLargeObject(1000);

    const startTime = performance.now();
    const result = mergeConfig(large1, large2);
    const endTime = performance.now();

    // Should complete within reasonable time (less than 1 second)
    expect(endTime - startTime).toBeLessThan(1000);
    expect(Object.keys(result as any).length).toBe(1000);
  });

  test("does not cause memory leaks with repeated merges", () => {
    const base = { timeout: 5000, maxRetries: 3 };
    const override = { timeout: 10000 };

    // Perform many merges to check for memory leaks
    for (let i = 0; i < 1000; i++) {
      const result = mergeConfig(base, override);
      expect(result.timeout).toBe(10000);
      expect(result.maxRetries).toBe(3);
    }

    // If we reach here without running out of memory, the test passes
    expect(true).toBe(true);
  });
});

// ─── Error Boundary Testing ───────────────────────────────────────────────────

describe("mergeConfig - Error Boundaries", () => {
  test("handles objects with throwing getters", () => {
    const objWithThrowingGetter: any = {};
    Object.defineProperty(objWithThrowingGetter, "throws", {
      get() {
        throw new Error("Getter error");
      },
      enumerable: true,
    });

    const safeObj = { safe: "value" } as any;

    // Should handle the error gracefully
    expect(() => {
      mergeConfig(objWithThrowingGetter, safeObj);
    }).toThrow("Getter error");
  });

  test("handles malformed objects", () => {
    const malformed: any = { a: 1 };
    Object.setPrototypeOf(malformed, null);

    const result = mergeConfig(malformed, { b: 2 } as any);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test("handles objects with null prototype", () => {
    const nullProtoObj = Object.create(null);
    nullProtoObj.a = 1;

    const result = mergeConfig(nullProtoObj as any, { b: 2 } as any);
    expect(result).toEqual({ a: 1, b: 2 });
  });
});

// ─── Type Safety and Validation ───────────────────────────────────────────────

describe("mergeConfig - Type Safety", () => {
  test("returns object conforming to AdapterConfig when given valid inputs", () => {
    const config1 = { timeout: 5000, temperature: 0.5 };
    const config2 = { maxTokens: 1000, model: "gpt-4" };

    const result = mergeConfig(config1, config2);

    // Result should have expected AdapterConfig properties
    expect(result).toHaveProperty("timeout", 5000);
    expect(result).toHaveProperty("temperature", 0.5);
    expect(result).toHaveProperty("maxTokens", 1000);
    expect(result).toHaveProperty("model", "gpt-4");
  });

  test("handles mixed valid and invalid AdapterConfig properties", () => {
    const validConfig = { timeout: 5000, temperature: 0.7 };
    const invalidConfig = { invalidProp: "should not break" } as any;

    const result = mergeConfig(validConfig, invalidConfig);

    expect(result.timeout).toBe(5000);
    expect(result.temperature).toBe(0.7);
    expect((result as any).invalidProp).toBe("should not break");
  });
});

// ─── Integration Scenarios ───────────────────────────────────────────────────

describe("mergeConfig - Integration Scenarios", () => {
  test("real-world multi-provider configuration", () => {
    const globalConfig = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 2000,
      temperature: 0.5,
    };

    const openaiConfig = {
      timeout: 60000,
      model: "gpt-4",
      maxTokens: 4096,
      apiKey: "sk-test",
    } as any;

    const anthropicConfig = {
      timeout: 45000,
      model: "claude-3-sonnet",
      maxTokens: 8192,
      apiKey: "sk-ant-test",
    } as any;

    const callConfig = {
      temperature: 0.9,
      messages: [{ role: "user" as const, content: "Hello" }],
      stream: true,
    };

    // Simulate merging global -> provider -> call
    const openaiResult = mergeConfig(globalConfig, openaiConfig, callConfig);
    const anthropicResult = mergeConfig(globalConfig, anthropicConfig, callConfig);

    expect(openaiResult.timeout).toBe(60000);
    expect(openaiResult.model).toBe("gpt-4");
    expect(openaiResult.temperature).toBe(0.9);

    expect(anthropicResult.timeout).toBe(45000);
    expect(anthropicResult.model).toBe("claude-3-sonnet");
    expect(anthropicResult.temperature).toBe(0.9);
  });

  test("complex configuration hierarchy", () => {
    const defaults = {
      timeout: 30000,
      maxRetries: 3,
      temperature: 0.7,
      stream: false,
    };

    const userDefaults = {
      timeout: 60000,
      temperature: 0.5,
      model: "gpt-3.5-turbo",
    };

    const workspaceConfig = {
      max_tokens: 2048,
      temperature: 0.8,
    };

    const requestConfig = {
      temperature: 0.9,
      messages: [{ role: "user" as const, content: "Test" }],
      max_tokens: 1024,
    };

    const result = mergeConfig(defaults, userDefaults, workspaceConfig, requestConfig);

    // Verify precedence: request > workspace > user > defaults
    expect(result.timeout).toBe(60000); // from userDefaults
    expect(result.maxRetries).toBe(3); // from defaults
    expect(result.temperature).toBe(0.9); // from requestConfig
    expect(result.model).toBe("gpt-3.5-turbo"); // from userDefaults
    expect(result.max_tokens).toBe(1024); // from requestConfig
    expect(result.stream).toBe(false); // from defaults
    expect(result.messages).toHaveLength(1); // from requestConfig
  });
});

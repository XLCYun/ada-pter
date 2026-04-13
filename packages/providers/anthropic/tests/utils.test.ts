import { describe, expect, test } from "bun:test";
import { mergeCacheControl } from "../src/utils";

describe("mergeCacheControl", () => {
  test("将 source 的 cache_control 合并到 target", () => {
    const cache = { type: "ephemeral" as const, ttl: "5m" as const };
    const out = mergeCacheControl({ type: "text", text: "hi" }, { cache_control: cache });
    expect(out).toEqual({ type: "text", text: "hi", cache_control: cache });
  });

  test("source 无 cache_control 时保留 target 原有字段且不添加 cache_control", () => {
    const target = { type: "text", text: "x" };
    const out = mergeCacheControl(target, {});
    expect(out).toEqual(target);
    expect(Object.hasOwn(out, "cache_control")).toBe(false);
  });

  test("source.cache_control 为 undefined 时不覆盖 target 上已有的 cache_control", () => {
    const existing = { type: "ephemeral" as const };
    const out = mergeCacheControl(
      { type: "text", text: "a", cache_control: existing },
      { cache_control: undefined },
    );
    expect(out.cache_control).toEqual(existing);
  });

  test("source 的 cache_control 覆盖 target 上已有的 cache_control", () => {
    const next = { type: "ephemeral" as const, ttl: "1h" as const };
    const out = mergeCacheControl(
      { type: "text", text: "b", cache_control: { type: "ephemeral" } },
      { cache_control: next },
    );
    expect(out.cache_control).toEqual(next);
  });

  test("返回新对象且不修改 target 与 source", () => {
    const target = { type: "text", text: "c" } as const;
    const source = { cache_control: { type: "ephemeral" as const } };
    const out = mergeCacheControl(target, source);
    expect(out).not.toBe(target);
    expect(out).not.toBe(source);
    expect(target).toEqual({ type: "text", text: "c" });
    expect(source).toEqual({ cache_control: { type: "ephemeral" } });
  });
});

import { describe, expect, test } from "bun:test";
import { mapWebSearchTool } from "../src/web-search";

describe("mapWebSearchTool", () => {
  test("空 options 返回基础 web_search_20250305 工具", () => {
    const tool = mapWebSearchTool({});
    expect(tool.type).toBe("web_search_20250305");
    expect(tool.name).toBe("web_search");
    expect(tool.user_location).toBeUndefined();
    expect(tool.max_uses).toBeUndefined();
  });

  test("search_context_size=low 映射为 max_uses=1", () => {
    const tool = mapWebSearchTool({ search_context_size: "low" });
    expect(tool.max_uses).toBe(1);
  });

  test("search_context_size=medium 映射为 max_uses=5", () => {
    const tool = mapWebSearchTool({ search_context_size: "medium" });
    expect(tool.max_uses).toBe(5);
  });

  test("search_context_size=high 映射为 max_uses=10", () => {
    const tool = mapWebSearchTool({ search_context_size: "high" });
    expect(tool.max_uses).toBe(10);
  });

  test("search_context_size 为其他值时不设置 max_uses", () => {
    // @ts-expect-error 测试非法值
    const tool = mapWebSearchTool({ search_context_size: "ultra" });
    expect(tool.max_uses).toBeUndefined();
  });

  test("user_location.approximate 中的 city/country/region/timezone 被映射", () => {
    const tool = mapWebSearchTool({
      user_location: {
        approximate: {
          city: "Shanghai",
          country: "CN",
          region: "Shanghai",
          timezone: "Asia/Shanghai",
        },
        type: "approximate",
      },
    });
    expect(tool.user_location).toBeDefined();
    expect(tool.user_location?.type).toBe("approximate");
    expect(tool.user_location?.city).toBe("Shanghai");
    expect(tool.user_location?.country).toBe("CN");
    expect(tool.user_location?.region).toBe("Shanghai");
    expect(tool.user_location?.timezone).toBe("Asia/Shanghai");
  });

  test("user_location.approximate 中缺失字段不被添加到 user_location", () => {
    const tool = mapWebSearchTool({
      user_location: {
        approximate: { country: "US" },
        type: "approximate",
      },
    });
    expect(tool.user_location?.country).toBe("US");
    expect(Object.hasOwn(tool.user_location ?? {}, "city")).toBe(false);
    expect(Object.hasOwn(tool.user_location ?? {}, "region")).toBe(false);
    expect(Object.hasOwn(tool.user_location ?? {}, "timezone")).toBe(false);
  });

  test("user_location 为 null 时不设置 user_location", () => {
    const tool = mapWebSearchTool({ user_location: null as unknown as undefined });
    expect(tool.user_location).toBeUndefined();
  });

  test("同时设置 search_context_size 和 user_location", () => {
    const tool = mapWebSearchTool({
      search_context_size: "high",
      user_location: {
        approximate: { country: "JP" },
        type: "approximate",
      },
    });
    expect(tool.max_uses).toBe(10);
    expect(tool.user_location?.country).toBe("JP");
  });
});

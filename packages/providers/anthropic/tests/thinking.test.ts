import { describe, expect, test } from "bun:test";
import type { OpenAICompletionConfig } from "../src/request-params";
import {
  DEFAULT_REASONING_EFFORT_BUDGETS,
  resolveThinkingOptions,
  ThinkingManager,
} from "../src/thinking";

const emptyMessagesCfg = (model: string, overrides: Partial<OpenAICompletionConfig> = {}): OpenAICompletionConfig => ({
  messages: [],
  model,
  ...overrides,
});

describe("DEFAULT_REASONING_EFFORT_BUDGETS", () => {
  test("各档位的默认 budget_tokens 与实现一致", () => {
    expect(DEFAULT_REASONING_EFFORT_BUDGETS).toEqual({
      minimal: 128,
      low: 1024,
      medium: 2048,
      high: 4096,
      xhigh: 4096,
    });
  });
});

describe("resolveThinkingOptions", () => {
  test("无参数时合并为完整默认 budgets", () => {
    expect(resolveThinkingOptions()).toEqual({
      reasoningEffortBudgets: { ...DEFAULT_REASONING_EFFORT_BUDGETS },
    });
  });

  test("可局部覆盖 reasoningEffortBudgets，其余保留默认", () => {
    const out = resolveThinkingOptions({
      reasoningEffortBudgets: { medium: 3000, high: 5000 },
    });
    expect(out.reasoningEffortBudgets).toEqual({
      ...DEFAULT_REASONING_EFFORT_BUDGETS,
      medium: 3000,
      high: 5000,
    });
  });
});

describe("ThinkingManager.resolveThinking", () => {
  const opts = resolveThinkingOptions();

  test("reasoning_effort 缺失或为 none / null 时不生成 thinking", () => {
    expect(new ThinkingManager(opts, emptyMessagesCfg("claude-3-5-sonnet-latest")).resolveThinking()).toBeUndefined();
    expect(
      new ThinkingManager(opts, emptyMessagesCfg("claude-3-5-sonnet-latest", { reasoning_effort: "none" })).resolveThinking(),
    ).toBeUndefined();
    expect(
      new ThinkingManager(opts, emptyMessagesCfg("claude-3-5-sonnet-latest", { reasoning_effort: null })).resolveThinking(),
    ).toBeUndefined();
  });

  test("claude-opus-4-6* 将任意非 none 的 reasoning_effort 映射为 adaptive", () => {
    const model = "claude-opus-4-6-20250514";
    for (const reasoning_effort of ["minimal", "low", "medium", "high", "xhigh"] as const) {
      expect(new ThinkingManager(opts, emptyMessagesCfg(model, { reasoning_effort })).resolveThinking()).toEqual({
        type: "adaptive",
      });
    }
  });

  test("非 4-6 模型将 reasoning_effort 映射为 enabled + budget_tokens（默认表）", () => {
    const cfg = emptyMessagesCfg("claude-opus-4-5-20250514", { reasoning_effort: "medium" });
    expect(new ThinkingManager(opts, cfg).resolveThinking()).toEqual({
      type: "enabled",
      budget_tokens: DEFAULT_REASONING_EFFORT_BUDGETS.medium,
    });
  });

  test("自定义 budgets 会参与 enabled 分支的取值", () => {
    const custom = resolveThinkingOptions({ reasoningEffortBudgets: { medium: 777 } });
    const cfg = emptyMessagesCfg("claude-sonnet-4-20250514", { reasoning_effort: "medium" });
    expect(new ThinkingManager(custom, cfg).resolveThinking()).toEqual({
      type: "enabled",
      budget_tokens: 777,
    });
  });

  test("budget 为 0 时视为无效，返回 undefined", () => {
    const zeroMedium = resolveThinkingOptions({ reasoningEffortBudgets: { medium: 0 } });
    const cfg = emptyMessagesCfg("claude-3-5-haiku-latest", { reasoning_effort: "medium" });
    expect(new ThinkingManager(zeroMedium, cfg).resolveThinking()).toBeUndefined();
  });
});

describe("ThinkingManager.resolveEffort", () => {
  const opts = resolveThinkingOptions();

  test("非 Opus 4.5 / 4.6 模型不设置 effort", () => {
    const m = new ThinkingManager(opts, emptyMessagesCfg("claude-3-5-sonnet-latest", { reasoning_effort: "high" }));
    expect(m.resolveEffort()).toEqual({ output_config: {}, effortUsed: false });
  });

  test("Opus 4.5 / 4.6 在 reasoning_effort 缺失或为 none / null 时不启用 effort", () => {
    for (const model of ["claude-opus-4-5-20250514", "claude-opus-4-6-20250514"] as const) {
      expect(new ThinkingManager(opts, emptyMessagesCfg(model)).resolveEffort()).toEqual({
        output_config: {},
        effortUsed: false,
      });
      expect(
        new ThinkingManager(opts, emptyMessagesCfg(model, { reasoning_effort: "none" })).resolveEffort(),
      ).toEqual({ output_config: {}, effortUsed: false });
      expect(
        new ThinkingManager(opts, emptyMessagesCfg(model, { reasoning_effort: null })).resolveEffort(),
      ).toEqual({ output_config: {}, effortUsed: false });
    }
  });

  test("Opus 4.5 将 reasoning_effort 映射到 output_config.effort（xhigh 仍为 high）", () => {
    const model = "claude-opus-4-5-20250514";
    expect(
      new ThinkingManager(opts, emptyMessagesCfg(model, { reasoning_effort: "minimal" })).resolveEffort(),
    ).toEqual({ output_config: { effort: "low" }, effortUsed: true });
    expect(
      new ThinkingManager(opts, emptyMessagesCfg(model, { reasoning_effort: "low" })).resolveEffort(),
    ).toEqual({ output_config: { effort: "low" }, effortUsed: true });
    expect(
      new ThinkingManager(opts, emptyMessagesCfg(model, { reasoning_effort: "medium" })).resolveEffort(),
    ).toEqual({ output_config: { effort: "medium" }, effortUsed: true });
    expect(
      new ThinkingManager(opts, emptyMessagesCfg(model, { reasoning_effort: "high" })).resolveEffort(),
    ).toEqual({ output_config: { effort: "high" }, effortUsed: true });
    expect(
      new ThinkingManager(opts, emptyMessagesCfg(model, { reasoning_effort: "xhigh" })).resolveEffort(),
    ).toEqual({ output_config: { effort: "high" }, effortUsed: true });
  });

  test("Opus 4.6 上 xhigh 映射为 max，其余与 4.5 一致", () => {
    const model = "claude-opus-4-6-20250514";
    expect(
      new ThinkingManager(opts, emptyMessagesCfg(model, { reasoning_effort: "xhigh" })).resolveEffort(),
    ).toEqual({ output_config: { effort: "max" }, effortUsed: true });
    expect(
      new ThinkingManager(opts, emptyMessagesCfg(model, { reasoning_effort: "high" })).resolveEffort(),
    ).toEqual({ output_config: { effort: "high" }, effortUsed: true });
  });
});

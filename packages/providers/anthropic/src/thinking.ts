import type { ReasoningEffort } from "ada-pter/types/openai";
import type { OpenAICompletionConfig } from "./request-params";
import type { MessageCreateParamsBase, OutputConfig } from "./types/messages";

/**
 * Effort / thinking handling summary:
 * - Model claude-opus-4-5*: output_config.effort honored; reasoning_effort fills effort if missing; thinking honored, else reasoning_effort -> thinking {type: "enabled", budget_tokens mapped}; effort beta header sent when effort present.
 * - Model claude-opus-4-6*: same effort rules; reasoning_effort maps thinking to {type: "adaptive"} when absent.
 * - Other models: effort untouched; reasoning_effort only maps thinking to {type: "enabled", budget_tokens mapped} when thinking absent.
 */

export type ReasoningEffortLevel = Extract<ReasoningEffort, "minimal" | "low" | "medium" | "high" | "xhigh">;

export type ReasoningEffortBudgets = Record<ReasoningEffortLevel, number>;

export type AnthropicThinkingOptions = {
  reasoningEffortBudgets?: Partial<ReasoningEffortBudgets>;
};

export type ResolvedThinkingOptions = {
  reasoningEffortBudgets: ReasoningEffortBudgets;
};

export const DEFAULT_REASONING_EFFORT_BUDGETS: ReasoningEffortBudgets = {
  minimal: 128,
  low: 1024,
  medium: 2048,
  high: 4096,
  xhigh: 4096,
};

export const resolveThinkingOptions = (options?: AnthropicThinkingOptions): ResolvedThinkingOptions => ({
  reasoningEffortBudgets: {
    ...DEFAULT_REASONING_EFFORT_BUDGETS,
    ...(options?.reasoningEffortBudgets ?? {}),
  },
});

export class ThinkingManager {
  private readonly model: string;
  private readonly isOpus45: boolean;
  private readonly isOpus46: boolean;

  constructor(
    private readonly options: ResolvedThinkingOptions,
    private readonly cfg: OpenAICompletionConfig,
  ) {
    this.model = this.cfg.model;
    this.isOpus45 = this.model.startsWith("claude-opus-4-5");
    this.isOpus46 = this.model.startsWith("claude-opus-4-6");
  }

  resolveThinking(): MessageCreateParamsBase["thinking"] | undefined {
    // if thinking is present, use it
    // TODO: use passthrough instead of this
    // const { thinking } = this.cfg;
    // if (thinking) return thinking;

    const { reasoning_effort } = this.cfg;
    if (!reasoning_effort || reasoning_effort === "none") return undefined;

    // if reasoning_effort is present
    if (this.isOpus46) return { type: "adaptive" };
    // opus 4.5 or others
    const budget = this.options.reasoningEffortBudgets[reasoning_effort as ReasoningEffortLevel];
    return budget ? { type: "enabled", budget_tokens: budget } : undefined;
  }

  resolveEffort(): {
    output_config: MessageCreateParamsBase["output_config"];
    effortUsed: boolean;
  } {
    // if output_config is present, use it
    // TODO: use passthrough instead of this
    // const oc = this.cfg.output_config ?? {};
    // if (oc?.effort) return { output_config: oc, effortUsed: Boolean(oc?.effort) };

    const oc: MessageCreateParamsBase["output_config"] = {};
    // only opus 4.5 and 4.6 support effort
    if (!this.isOpus45 && !this.isOpus46) return { output_config: oc, effortUsed: false };

    // if effort also not present or none, return undefined
    const effort = this.cfg.reasoning_effort ?? "";
    if (!effort || effort === "none") return { output_config: oc, effortUsed: false };

    const effortMap: Record<ReasoningEffortLevel, OutputConfig["effort"]> = {
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: this.isOpus46 ? "max" : "high",
    };
    oc.effort = effortMap[effort as ReasoningEffortLevel];
    return { output_config: oc, effortUsed: true };
  }
}

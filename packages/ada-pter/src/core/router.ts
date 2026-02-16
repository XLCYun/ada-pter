import {
  InvalidModelError,
  NoProviderError,
  UnsupportedApiError,
} from "../errors";
import type { Provider } from "../types";
import type { AdapterContext } from "../types/core";
import type { MatchPattern, RouteCondition, RouteEntry } from "../types/route";
import { autoLoader } from "./auto-loader";
import { inferProvider } from "./infer-providers";

// ─── Model string parsing ─────────────────────────────────────────────────

export interface ParsedModelId {
  /** The full prefixed model string. */
  modelId: string;
  /** Provider prefix extracted from modelId (e.g. "openai", "OpenAI"). */
  providerKey: string;
  /** Model name with prefix stripped (e.g. "gpt-4", "GPT-4"). */
  model: string;

  /** Lowercased model name for matching. */
  normModel: string;
  /** Lowercased provider name for matching. */
  normProvider: string;
  /** Lowercased composite id `${normProvider}/${normModel}` for matching. */
  normModelId: string;
}

/**
 * Parse a model string into its components.
 * "openai/gpt-4" -> { modelId: "openai/gpt-4", providerKey: "openai", model: "gpt-4" }
 * "gpt-4"        -> { modelId: "custom/gpt-4", providerKey: "custom", model: "gpt-4" }
 */
export function parseModelId(modelId: string): ParsedModelId {
  // Validate input
  if (!modelId) {
    throw new InvalidModelError(modelId, "model ID cannot be empty");
  }

  if (modelId.startsWith("/")) {
    throw new InvalidModelError(modelId, "provider component cannot be empty");
  }

  if (modelId.endsWith("/")) {
    throw new InvalidModelError(modelId, "model component cannot be empty");
  }

  if (modelId.includes("//")) {
    throw new InvalidModelError(modelId, "empty component found in model ID");
  }

  const slashIndex = modelId.indexOf("/");
  if (slashIndex > 0) {
    const providerKey = modelId.slice(0, slashIndex);
    const model = modelId.slice(slashIndex + 1);
    const normProvider = providerKey.toLowerCase();
    const normModel = model.toLowerCase();
    return {
      modelId,
      providerKey,
      model,
      normProvider,
      normModel,
      normModelId: `${normProvider}/${normModel}`,
    };
  }

  const model = modelId;
  const inferredProviderKey = inferProvider(model);
  const normProvider = inferredProviderKey.toLowerCase();
  const normModel = model.toLowerCase();
  const providerKey = normProvider;
  return {
    modelId: `${providerKey}/${model}`,
    providerKey,
    model,
    normProvider,
    normModel,
    normModelId: `${normProvider}/${normModel}`,
  };
}

// ─── Pattern matching ──────────────────────────────────────────────────────

/**
 * Check whether a MatchPattern matches a given value.
 * Supports string (exact), RegExp, array (OR), and function.
 */
export function matchPattern(pattern: MatchPattern, value: string): boolean {
  const loValue = value.toLowerCase();
  if (typeof pattern === "string") return pattern.toLowerCase() === loValue;
  if (pattern instanceof RegExp) return pattern.test(loValue);
  if (Array.isArray(pattern))
    return pattern.some((p) => matchPattern(p, loValue));
  if (typeof pattern === "function") return pattern(loValue);
  return false;
}

// ─── Route condition matching ──────────────────────────────────────────────

/**
 * Check whether a RouteCondition matches the current context.
 *
 * - { modelId: pattern } — matches against ctx.normModelId (normalized full string)
 * - { model: pattern }   — matches against ctx.normModel (normalized model name)
 * - { provider: ... }    — matches against ctx.normProvider; skips if no prefix
 */
export function matchCondition(
  condition: RouteCondition,
  ctx: AdapterContext,
): boolean {
  if ("modelId" in condition)
    return matchPattern(condition.modelId, ctx.normModelId);
  if ("model" in condition) return matchPattern(condition.model, ctx.normModel);
  if ("provider" in condition)
    return matchPattern(condition.provider, ctx.normProvider);
  return false;
}

// ─── Route chain resolution ────────────────────────────────────────────────

function setProviderAndHandler(ctx: AdapterContext, provider: Provider): void {
  ctx.provider = provider;
  const handler = provider.getHandler(ctx);
  if (!handler) {
    throw new UnsupportedApiError(provider.name, ctx.apiType);
  }
  ctx.handler = handler;
}

/**
 * Traverse the route chain to find and set the matching provider + handler on ctx.
 *
 * Semantics:
 * - Condition route match → committed: getHandler returns null → UnsupportedApiError
 * - Resolver returns provider → committed: getHandler returns null → UnsupportedApiError
 * - Resolver returns null/undefined → skip to next entry
 * - Auto route → uses autoLoader.resolve(); if provider is returned but lacks a handler → UnsupportedApiError
 *
 * Throws NoProviderError if no route matches.
 * Throws UnsupportedApiError if provider is found but handler is not compatible.
 */
export async function resolveFromRouteChain(
  ctx: AdapterContext,
  entries: RouteEntry[],
): Promise<void> {
  for (const entry of entries) {
    if (entry.type === "condition") {
      if (!matchCondition(entry.condition, ctx)) continue;
      setProviderAndHandler(ctx, entry.provider);
      return;
    }

    if (entry.type === "resolver") {
      const provider = entry.resolver(ctx);
      if (!provider) continue;
      setProviderAndHandler(ctx, provider);
      return;
    }

    if (entry.type === "auto") {
      const provider = await autoLoader.resolve(ctx);
      if (!provider) continue;
      setProviderAndHandler(ctx, provider);
      return;
    }
  }

  throw new NoProviderError(ctx.modelId ?? ctx.model ?? "unknown");
}

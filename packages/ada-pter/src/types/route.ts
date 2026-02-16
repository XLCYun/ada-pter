import type { AdapterContext } from "./core";
import type { Provider } from "./provider";

/**
 * Match pattern for a single dimension.
 * - string: exact match
 * - RegExp: regex match
 * - (string | RegExp)[]: OR — matches if any element matches
 * - function: custom match logic
 */
export type MatchPattern =
  | string
  | RegExp
  | (string | RegExp)[]
  | ((value: string) => boolean);

/**
 * Route condition — exactly ONE of three mutually exclusive fields.
 * Enforced via TypeScript union type to eliminate ambiguity.
 *
 * - modelId: matches the full model string (e.g. "openai/gpt-4" or "gpt-4")
 * - model:   matches the modelName after stripping the prefix (e.g. "gpt-4")
 * - provider: matches the provider prefix (e.g. "openai"); skips when no prefix
 */
export type RouteCondition =
  | { modelId: MatchPattern }
  | { model: MatchPattern }
  | { provider: MatchPattern };

/**
 * Custom route resolver function.
 * Returns a Provider to use, or null/undefined to skip to the next route entry.
 */
export type RouteResolver = (
  ctx: AdapterContext,
) => Provider | null | undefined;

/**
 * Internal route chain entry. Each call to adapter.route() or adapter.autoRoute()
 * appends one entry to the chain.
 */
export type RouteEntry =
  | { type: "condition"; condition: RouteCondition; provider: Provider }
  | { type: "resolver"; resolver: RouteResolver }
  | { type: "auto" };

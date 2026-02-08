import type { AdapterConfig, ResolvedConfig } from '../types';

/**
 * Known configuration keys defined in AdapterConfig.
 * Used by extractConfig() to separate config fields from request parameters.
 *
 * Maintained as a Set for O(1) lookup performance.
 */
const CONFIG_KEYS: ReadonlySet<string> = new Set<keyof AdapterConfig>([
  'timeout',
  'temperature',
  'maxTokens',
  'maxRetries',
  'retryDelay',
  'fallbackModels',
  'onFallback',
  'providers',
]);

/**
 * Check whether a value is a plain object (not an array, null, Date, RegExp, etc.).
 * Used by deepMerge to decide whether to recurse into a value.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-merge multiple configuration sources into a single ResolvedConfig.
 *
 * Merge strategy (matches the design spec):
 *  - Later sources override earlier ones (call-level > API-level > global).
 *  - Plain-object fields are merged recursively.
 *  - Arrays are replaced entirely (not concatenated).
 *  - Primitive values, functions, and non-plain objects (Date, RegExp, etc.)
 *    are overwritten by the later source.
 *  - `undefined` sources are silently skipped.
 *
 * @example
 * ```ts
 * const merged = deepMerge(
 *   { timeout: 5000, maxRetries: 3 },         // global
 *   { timeout: 10000 },                        // API-level
 *   { temperature: 0.7 },                      // call-level
 * );
 * // => { timeout: 10000, maxRetries: 3, temperature: 0.7 }
 * ```
 */
export function deepMerge(
  ...sources: Array<Record<string, unknown> | undefined>
): ResolvedConfig {
  const result: Record<string, unknown> = {};

  for (const source of sources) {
    if (source === undefined || source === null) continue;

    for (const key of Object.keys(source)) {
      const srcVal = source[key];
      const dstVal = result[key];

      // Both sides are plain objects → recurse
      if (isPlainObject(dstVal) && isPlainObject(srcVal)) {
        result[key] = deepMerge(dstVal, srcVal);
      } else {
        // Primitives, arrays, functions, non-plain objects → overwrite
        result[key] = srcVal;
      }
    }
  }

  return result as ResolvedConfig;
}

/**
 * Extract known AdapterConfig fields from call parameters.
 *
 * When a user calls `adapter.completion({ model, messages, temperature, timeout })`,
 * fields like `temperature` and `timeout` are config concerns, not part of the
 * API request body. This function separates them so the framework can merge
 * them into ctx.config while keeping ctx.request clean.
 *
 * Only fields whose value is not `undefined` are included in the result.
 *
 * @returns An object with two properties:
 *  - `config`: Extracted config fields (Partial<AdapterConfig>).
 *  - `rest`: Remaining fields that belong to the request body.
 */
export function extractConfig(params: Record<string, unknown>): {
  config: Partial<AdapterConfig>;
  rest: Record<string, unknown>;
} {
  const config: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};

  for (const key of Object.keys(params)) {
    if (CONFIG_KEYS.has(key)) {
      if (params[key] !== undefined) {
        config[key] = params[key];
      }
    } else {
      rest[key] = params[key];
    }
  }

  return {
    config: config as Partial<AdapterConfig>,
    rest,
  };
}

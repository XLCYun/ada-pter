import type { AdapterConfig } from "../types";

/**
 * Check whether a value is a plain object (not an array, null, Date, RegExp, etc.).
 * Used by deepMerge to decide whether to recurse into a value.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-merge multiple configuration sources into a single AdapterConfig.
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
  ...sources: Array<Partial<AdapterConfig> | undefined>
): AdapterConfig {
  const result: Record<string, unknown> = {};

  sources
    .filter((source) => source !== undefined && source !== null)
    .forEach((source) => {
      Object.keys(source as Record<string, unknown>).forEach((key) => {
        const srcVal = (source as Record<string, unknown>)[key];
        const dstVal = result[key];
        result[key] =
          isPlainObject(dstVal) && isPlainObject(srcVal)
            ? deepMerge(
                dstVal as Partial<AdapterConfig>,
                srcVal as Partial<AdapterConfig>,
              )
            : srcVal;
      });
    });

  return result as AdapterConfig;
}

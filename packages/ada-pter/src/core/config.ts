import type { AdapterConfig } from "../types";

/**
 * Fields whose internal key-value pairs should be merged across levels
 * (one level deep, no recursion into nested objects within them).
 */
const MERGED_KEYS = new Set(["extraBody", "extraHeaders"]);

/**
 * Merge multiple configuration sources into a single AdapterConfig using a
 * hybrid strategy:
 *
 * - **Top-level fields**: shallow merge — later source overrides earlier.
 * - **`extraBody` / `extraHeaders`**: their *internal* key-value pairs are
 *   merged across all levels (same key: later value wins). Only one level deep;
 *   nested objects within these fields are NOT recursively merged.
 * - All other nested objects are **replaced entirely** (no recursion).
 * - `null` / `undefined` sources are silently skipped.
 * - Source objects are never mutated.
 *
 * @example
 * ```ts
 * const merged = mergeConfig(
 *   { timeout: 5000, maxRetries: 3 },         // global
 *   { timeout: 10000 },                        // API-level
 *   { temperature: 0.7 },                      // call-level
 * );
 * // => { timeout: 10000, maxRetries: 3, temperature: 0.7 }
 * ```
 */
function isMergeable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeConfig(...sources: Array<Partial<AdapterConfig> | undefined>): AdapterConfig {
  const result: Record<string, unknown> = {};

  for (const source of sources) {
    if (source == null) continue;
    const src = source as Record<string, unknown>;

    for (const key of Object.keys(src)) {
      const srcVal = src[key];
      if (MERGED_KEYS.has(key) && isMergeable(result[key]) && isMergeable(srcVal)) {
        result[key] = { ...result[key], ...srcVal };
      } else {
        result[key] = srcVal;
      }
    }
  }

  return result as AdapterConfig;
}

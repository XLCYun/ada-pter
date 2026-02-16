import type { Provider } from "./types/provider";

/**
 * Validate and freeze a Provider configuration object.
 *
 * Responsibilities:
 * 1. Validate required fields (name, getHandler must exist).
 * 2. Freeze the object to prevent accidental mutation.
 * 3. Return the validated Provider (for use with adapter.route()).
 */
export function defineProvider(config: Provider): Provider {
  // ── Validate required fields ──
  if (!config.name || typeof config.name !== "string") {
    throw new Error(
      'defineProvider: "name" is required and must be a non-empty string.',
    );
  }

  if (typeof config.getHandler !== "function") {
    throw new Error(
      'defineProvider: "getHandler" is required and must be a function.',
    );
  }

  // ── Freeze and return ──
  return Object.freeze(config);
}

import type { AdapterContext } from "../types/core";
import type { Provider } from "../types/provider";

export type AutoProviderModule = { autoProvider?: Provider };
export type AutoProviderImporter = (
  packageName: string,
) => Promise<AutoProviderModule>;

export type AutoLoaderOptions = {
  // for unit test
  importer?: AutoProviderImporter;
  packagePrefix?: string;
};

const defaultImporter: AutoProviderImporter = (packageName) =>
  import(packageName);

/**
 * AutoLoader is the implementation behind autoRoute().
 * It attempts to resolve a provider for the current context by:
 * 1. Inferring the provider name from the model prefix or built-in model registry.
 * 2. Dynamically importing the corresponding @ada-pter/* package.
 * 3. Checking getHandler() for compatibility.
 */
export class AutoLoader {
  /** Cache of already-loaded providers keyed by provider name. */
  private loaded = new Map<string, Provider>();
  /** Provider names whose dynamic import previously failed. */
  private failedImports = new Set<string>();

  private readonly importer: AutoProviderImporter;
  private readonly packagePrefix: string;

  constructor(options: AutoLoaderOptions = {}) {
    this.importer = options.importer ?? defaultImporter;
    this.packagePrefix = options.packagePrefix ?? "@ada-pter/";
  }

  /**
   * Attempt to resolve a provider for the current context.
   * If provider prefix is "openai", then return openai provider
   * if provider prefix is absent, then try to infer provider from model name (e.g, "gpt-4o" -> "openai")
   * if we can't infer provider, then return openai as default
   */
  async resolve(ctx: AdapterContext): Promise<Provider | null> {
    const providerName = this.normalizeProviderName(ctx.normProvider);
    if (!providerName) return null;

    const provider = await this.resolveProvider(providerName);
    if (!provider) return null;
    if (!provider.getHandler(ctx)) return null; // check handler compatibility

    return provider;
  }

  private normalizeProviderName(
    providerName: string | undefined,
  ): string | null {
    if (!providerName) return null;
    return providerName === "custom" ? "openai" : providerName.toLowerCase();
  }

  /**
   * Attempt to dynamically import and instantiate a provider package.
   * Returns null if the package is not installed or fails to load.
   */
  private async resolveProvider(
    providerName: string,
  ): Promise<Provider | null> {
    // Avoid repeated dynamic imports when we already know it fails.
    if (this.failedImports.has(providerName)) return null;

    const loadedProvider = this.loaded.get(providerName) ?? null;
    if (loadedProvider) return loadedProvider;

    const packageName = `${this.packagePrefix}${providerName}`;
    try {
      const mod = await this.importer(packageName);
      const provider = mod?.autoProvider ?? null;
      // unable to resolve provider
      if (!provider) {
        this.failedImports.add(providerName);
        return null;
      }
      // cache provider
      this.loaded.set(providerName, provider);
      return provider;
    } catch {
      this.failedImports.add(providerName);
      return null;
    }
  }
}

/**
 * Shared singleton AutoLoader instance.
 *
 * Used by router auto-route resolution to avoid threading an AutoLoader instance
 * through every call site.
 */
export const autoLoader = new AutoLoader();

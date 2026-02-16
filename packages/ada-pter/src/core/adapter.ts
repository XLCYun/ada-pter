import { getContentType, hasJsonContentType } from "../transformers/utils";
import type {
	AdapterConfig,
	AdapterContext,
	ApiType,
	CompletionRequest,
	CompletionResponse,
	Middleware,
	Provider,
	StreamChunk,
} from "../types";
import type { RouteCondition, RouteEntry, RouteResolver } from "../types/route";
import { compose } from "./compose";
import { deepMerge } from "./config";
import { createRequestMiddleware } from "./request";
import { parseModelId, resolveFromRouteChain } from "./router";

/**
 * Core adapter class. Provides a fluent API for:
 * - use(): register middleware (functions only)
 * - route(): register provider routes (condition-based or function-based)
 * - autoRoute(): inject auto-load provider routing at the end of the route chain
 * - configure(): set global or API-level configuration
 * - completion(): type-safe API method
 */
export class AdaPter {
	private middlewares: Middleware[] = [];
	private routeEntries: RouteEntry[] = [];
	private globalConfig: Partial<AdapterConfig> = {};
	private apiConfigs = new Map<string, Partial<AdapterConfig>>();

	// ── Middleware registration ──────────────────────────────────────────────

	/** Register a middleware function. Only functions are accepted; use route() for providers. */
	use(middleware: Middleware): this {
		this.middlewares.push(middleware);
		return this;
	}

	// ── Route chain ──────────────────────────────────────────────────────────

	/** Condition route: when condition matches, use the specified provider. */
	route(condition: RouteCondition, provider: Provider): this;
	/** Function route: custom logic, return provider or null (skip). */
	route(resolver: RouteResolver): this;
	route(
		conditionOrResolver: RouteCondition | RouteResolver,
		provider?: Provider,
	): this {
		if (typeof conditionOrResolver === "function") {
			this.routeEntries.push({
				type: "resolver",
				resolver: conditionOrResolver,
			});
			return this;
		}

		if (!provider) throw new Error("Provider is required for condition route");

		this.routeEntries.push({
			type: "condition",
			condition: conditionOrResolver,
			provider: provider,
		});
		return this;
	}

	/** Inject auto-load route at the end of the route chain (fallback). */
	autoRoute(): this {
		this.routeEntries.push({ type: "auto" });
		return this;
	}

	// ── Configuration ────────────────────────────────────────────────────────

	/** Set or merge global configuration (framework config + API params). */
	configure(config: Partial<AdapterConfig>): this;
	/** Set or merge API-level configuration. */
	configure(apiType: ApiType, config: Partial<AdapterConfig>): this;
	configure(
		configOrApiType: Partial<AdapterConfig> | ApiType,
		config?: Partial<AdapterConfig>,
	): this {
		if (typeof configOrApiType === "string") {
			// API-level config
			const existing = this.apiConfigs.get(configOrApiType) ?? {};
			this.apiConfigs.set(configOrApiType, deepMerge(existing, config));
			return this;
		}

		// Global config
		this.globalConfig = deepMerge(this.globalConfig, configOrApiType);
		return this;
	}
	// ── Internal execution ───────────────────────────────────────────────────

	/**
	 * All public API methods funnel through here.
	 *
	 * Flow:
	 * 1. Resolve config once (three-level merge: global > API-level > call-level).
	 * 2. Normalize models array from resolved config.
	 * 3. Fallback loop: for each model, create a fresh context (with model parsing,
	 *    route resolution, and handler request config), then run the full middleware pipeline.
	 * 4. On success -> return response. On failure -> try next model.
	 * 5. If all models fail -> throw the last error.
	 */
	private execute<TRes>(
		apiType: ApiType,
		params: Partial<AdapterConfig> & { stream: true },
	): AsyncIterable<TRes>;
	private execute<TRes>(
		apiType: ApiType,
		params: Partial<AdapterConfig> & { stream?: false | undefined },
	): Promise<TRes>;
	private execute<TRes>(
		apiType: ApiType,
		params: Partial<AdapterConfig>,
	): Promise<TRes> | AsyncIterable<TRes> {
		const { config, models } = this.resolveConfig(apiType, params);
		if (config.stream) {
			return this.executeAsStream<TRes>(apiType, config, models);
		}
		return this.executeAsPromise<TRes>(apiType, config, models);
	}

	private async executeAsPromise<TRes>(
		apiType: ApiType,
		config: AdapterConfig,
		models: string[],
	): Promise<TRes> {
		const ctx = await this.runWithFallback(apiType, config, models);
		return ctx.response.data as TRes;
	}

	private async *executeAsStream<TChunk>(
		apiType: ApiType,
		config: AdapterConfig,
		models: string[],
	): AsyncIterable<TChunk> {
		const ctx = await this.runWithFallback(apiType, config, models);
		const stream = ctx.response.data as AsyncIterable<TChunk> | undefined;
		if (stream) yield* stream;
	}

	// ── Internal helpers ────────────────────────────────────────────────────

	/**
	 * Three-level config merge (global > API-level > call-level), and normalize models list (fallback chain).
	 * All fields participate in the merge — no extractConfig separation.
	 * Only called once per request.
	 */
	private resolveConfig(
		apiType: ApiType,
		params: Partial<AdapterConfig>,
	): {
		config: AdapterConfig;
		models: string[];
	} {
		const config = deepMerge(
			this.globalConfig,
			this.apiConfigs.get(apiType) ?? {},
			params,
		);

		const modelConfig = config.model;
		if (!modelConfig) throw new Error("No model specified.");

		const models = Array.isArray(modelConfig) ? modelConfig : [modelConfig];
		if (models.length === 0) throw new Error("No model specified.");

		return { config, models };
	}

	/**
	 * Run the middleware pipeline with fallback across models.
	 *
	 * - Non-streaming success: ctx.response.data must be set by request middleware / handler.
	 * - Streaming success: ctx.response.data should be set to an AsyncIterable; if not, the stream yields nothing.
	 */
	private async runWithFallback(
		apiType: ApiType,
		config: AdapterConfig,
		models: string[],
	): Promise<AdapterContext> {
		const pipeline = this.buildPipeline();
		let lastError: Error | undefined;

		for (let i = 0; i < models.length; i++) {
			try {
				const ctx = await this.createContext(apiType, config, models[i]);
				await compose(pipeline)(ctx);
				return ctx;
			} catch (err) {
				lastError = err as Error;
				if (i < models.length - 1) {
					config.onFallback?.(lastError, models[i], models[i + 1]);
				}
			}
		}

		throw lastError ?? new Error(`All models failed: ${models.join(", ")}`);
	}

	/**
	 * Create a fully-resolved context for a single model.
	 *
	 * Receives the already-resolved config (so config merge only happens once)
	 * and the current model string. Performs:
	 * 1. Model ID parsing (prefix extraction).
	 * 2. Route resolution (sets ctx.provider and ctx.handler).
	 * 3. Calls handler.getRequestConfig() and merges the result into ctx.request,
	 *    so that middleware can inspect/modify the request config before it is sent.
	 */
	private async createContext(
		apiType: ApiType,
		config: AdapterConfig,
		model: string,
	): Promise<AdapterContext> {
		const parsed = parseModelId(model);

		const ctx: AdapterContext = {
			apiType,
			config,
			state: {},
			startTime: Date.now(),
			modelId: parsed.modelId,
			providerKey: parsed.providerKey,
			model: parsed.model,
			normModel: parsed.normModel,
			normProvider: parsed.normProvider,
			normModelId: parsed.normModelId,
			request: { url: "" },
			response: {},
		};

		// Route resolution — fills ctx.provider and ctx.handler
		await resolveFromRouteChain(ctx, this.routeEntries);

		const handlerConfig = ctx.handler!.getRequestConfig(ctx);

		const mergedRequest = { ...ctx.request, ...handlerConfig };
		const headers = new Headers(mergedRequest.headers);

		// ensure has content-type, default to application/json
		if (!getContentType(headers)) {
			headers.set("Content-Type", "application/json");
		}

		if (hasJsonContentType(headers)) {
			const body = mergedRequest.body;
			if (body != null && typeof body !== "string") {
				mergedRequest.body = JSON.stringify(body);
			}
		}

		mergedRequest.headers = headers;
		ctx.request = mergedRequest;

		return ctx;
	}

	/** Build the full middleware pipeline: user middlewares + internal request middleware. */
	private buildPipeline(): Middleware[] {
		const request = createRequestMiddleware();
		return [...this.middlewares, request];
	}

	// ── Public API methods ───────────────────────────────────────────────────

	completion(
		params: CompletionRequest & { stream: true },
	): AsyncIterable<StreamChunk>;
	completion(
		params: CompletionRequest & { stream?: false | undefined },
	): Promise<CompletionResponse>;
	completion(
		params: CompletionRequest,
	): Promise<CompletionResponse> | AsyncIterable<StreamChunk> {
		return this.execute<CompletionResponse | StreamChunk>(
			"completion",
			params as never,
		) as Promise<CompletionResponse> | AsyncIterable<StreamChunk>;
	}
}

/** Pre-created singleton instance for zero-config usage. */
export const adapter = new AdaPter();

/** Factory function for creating isolated instances. */
export function createAdapter(): AdaPter {
	return new AdaPter();
}

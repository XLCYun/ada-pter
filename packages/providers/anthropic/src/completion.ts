import type { AdapterContext, ApiHandler, Provider, RequestConfig, ResponseTransformer } from "ada-pter";
import { joinPath, jsonTransformer, resolveApiBase, resolveApiKey, resolveApiPath, sseTransformer } from "ada-pter";
import { buildBody, type OpenAICompletionConfig } from "./request-params";
import { transformParsedResponse } from "./response";
import { anthropicStreamingTransformer } from "./response-stream";
import { type AnthropicThinkingOptions, type ResolvedThinkingOptions, resolveThinkingOptions } from "./thinking";
import type { Message } from "./types/messages";

export const name = "@ada-pter/anthropic";

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const MESSAGES_PATH = "/messages";

export type { OpenAICompletionConfig };
export type AnthropicProviderOptions = AnthropicThinkingOptions;

const anthropicResponseTransformer: ResponseTransformer = async (ctx: AdapterContext) => {
  const data = ctx.response.data;
  if (data == null || typeof data !== "object") return;
  ctx.response.data = transformParsedResponse(data as Message);
};

const getRequestConfig = (ctx: AdapterContext, options: ResolvedThinkingOptions): RequestConfig => {
  const apiKey = resolveApiKey(ctx, { envName: "ANTHROPIC_API_KEY" });
  if (!apiKey) throw new Error("No Anthropic API key provided");

  const base =
    resolveApiBase(ctx, {
      envName: "ANTHROPIC_BASE_URL",
      default: ANTHROPIC_BASE,
    }) ?? "";
  const path = resolveApiPath(ctx, { default: MESSAGES_PATH }) ?? "";
  if (!base && !path) {
    throw new Error("No base URL or path provided");
  }

  const url = joinPath(base, path);
  const headers = new Headers();
  headers.set("x-api-key", apiKey);
  headers.set("Content-Type", "application/json");
  headers.set("anthropic-version", "2023-06-01");
  const { body, anthropicBetaValues } = buildBody(ctx, options);
  if (anthropicBetaValues.length > 0) headers.set("anthropic-beta", anthropicBetaValues.join(", "));
  return {
    url,
    method: "POST",
    headers,
    body: body as unknown as BodyInit,
  };
};

const buildHandlers = (options: ResolvedThinkingOptions): ApiHandler => ({
  getRequestConfig: (ctx) => getRequestConfig(ctx, options),
  responseTransformers: [jsonTransformer, anthropicResponseTransformer],
});

const buildStreamingHandlers = (options: ResolvedThinkingOptions): ApiHandler => ({
  getRequestConfig: (ctx) => getRequestConfig(ctx, options),
  responseTransformers: [sseTransformer, anthropicStreamingTransformer],
});

export const getProvider = (options?: AnthropicProviderOptions): Provider => {
  const resolvedOptions = resolveThinkingOptions(options);
  const completionHandler = buildHandlers(resolvedOptions);
  const streamingCompletionHandler = buildStreamingHandlers(resolvedOptions);
  return {
    name: "anthropic",
    getHandler(ctx: AdapterContext) {
      if (ctx.apiType !== "completion") return null;
      return ctx.config.stream ? streamingCompletionHandler : completionHandler;
    },
  };
};

export const autoProvider: Provider = getProvider();

import type {
  AdapterContext,
  ApiHandler,
  Provider,
  RequestConfig,
} from "ada-pter";
import {
  joinPath,
  jsonTransformer,
  resolveApiBase,
  resolveApiKey,
  resolveApiPath,
  sseTransformer,
} from "ada-pter";
import type { ChatCompletionCreateParamsBase } from "ada-pter/types/openai/completions";
import { OPENAI_BASE } from "./common";
import { getResponsesHandler } from "./responses";

export const name = "@ada-pter/openai";
const COMPLETION_PATH = "/chat/completions";

const buildBody = (ctx: AdapterContext) => {
  const cfg = ctx.config;
  const body: ChatCompletionCreateParamsBase = {
    model: ctx.model,
    messages: cfg.messages ?? [],
    audio: cfg.audio,
    functions: cfg.functions,
    function_call: cfg.function_call,
    logit_bias: cfg.logit_bias,
    logprobs: cfg.logprobs,
    max_completion_tokens: cfg.max_completion_tokens,
    max_tokens: cfg.max_tokens,
    metadata: cfg.metadata,
    modalities: cfg.modalities,
    n: cfg.n,
    parallel_tool_calls: cfg.parallel_tool_calls,
    prediction: cfg.prediction,
    presence_penalty: cfg.presence_penalty,
    prompt_cache_key: cfg.prompt_cache_key,
    prompt_cache_retention: cfg.prompt_cache_retention,
    reasoning_effort: cfg.reasoning_effort,
    response_format: cfg.response_format,
    safety_identifier: cfg.safety_identifier,
    seed: cfg.seed,
    service_tier: cfg.service_tier,
    stop: cfg.stop,
    store: cfg.store,
    stream: cfg.stream,
    stream_options: cfg.stream_options,
    temperature: cfg.temperature,
    tool_choice: cfg.tool_choice,
    tools: cfg.tools,
    top_logprobs: cfg.top_logprobs,
    top_p: cfg.top_p,
    user: cfg.user,
    verbosity: cfg.verbosity,
    web_search_options: cfg.web_search_options,
  };
  return body;
};

const getRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const apiKey = resolveApiKey(ctx, { envName: "OPENAI_API_KEY" });
  const base =
    resolveApiBase(ctx, {
      envName: "OPENAI_BASE_URL",
      default: OPENAI_BASE,
    }) ?? "";
  const path = resolveApiPath(ctx, { default: COMPLETION_PATH }) ?? "";
  if (!base && !path) {
    throw new Error("No base URL or path provided");
  }
  const url = joinPath(base, path);
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Content-Type", "application/json");
  return {
    url,
    method: "POST",
    headers,
    body: buildBody(ctx) as unknown as BodyInit,
  };
};

const completionHandler: ApiHandler = {
  getRequestConfig,
  responseTransformers: [jsonTransformer],
};

const streamingCompletionHandler: ApiHandler = {
  getRequestConfig,
  responseTransformers: [sseTransformer],
};

export const autoProvider: Provider = {
  name: "openai",
  getHandler(ctx: AdapterContext) {
    if (ctx.apiType === "completion") {
      return ctx.config.stream ? streamingCompletionHandler : completionHandler;
    }
    return getResponsesHandler(ctx);
  },
};

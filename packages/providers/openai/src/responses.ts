import type {
  AdapterContext,
  ApiHandler,
  RequestConfig,
  ResponseCompactRequest,
  ResponseCreateRequest,
  ResponseInputItemsListRequest,
  ResponseRetrieveRequest,
} from "ada-pter";
import {
  buildQuery,
  joinPath,
  jsonTransformer,
  resolveApiPath,
  sseTransformer,
} from "ada-pter";
import type {
  ResponseCancelParams,
  ResponseDeleteParams,
} from "ada-pter/types/openai/responses";
import { resolveRequestBase } from "./utils";

const RESPONSES_PATH = "/responses";
const RESPONSES_COMPACT_PATH = "/responses/compact";

const createRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const cfg = ctx.config as unknown as ResponseCreateRequest;
  const body: ResponseCreateRequest = {
    background: cfg.background,
    context_management: cfg.context_management,
    conversation: cfg.conversation,
    include: cfg.include,
    input: cfg.input,
    instructions: cfg.instructions,
    max_output_tokens: cfg.max_output_tokens,
    metadata: cfg.metadata,
    model: cfg.model,
    parallel_tool_calls: cfg.parallel_tool_calls,
    previous_response_id: cfg.previous_response_id,
    prompt: cfg.prompt,
    prompt_cache_key: cfg.prompt_cache_key,
    prompt_cache_retention: cfg.prompt_cache_retention,
    reasoning: cfg.reasoning,
    safety_identifier: cfg.safety_identifier,
    service_tier: cfg.service_tier,
    store: cfg.store,
    stream: cfg.stream,
    stream_options: cfg.stream_options,
    temperature: cfg.temperature,
    text: cfg.text,
    tool_choice: cfg.tool_choice,
    tools: cfg.tools,
    top_p: cfg.top_p,
    truncation: cfg.truncation,
    user: cfg.user,
  };
  const { base, headers } = resolveRequestBase(ctx);
  const path =
    resolveApiPath(ctx, { default: RESPONSES_PATH }) ?? RESPONSES_PATH;
  const url = joinPath(base, path);
  return {
    url,
    method: "POST",
    headers,
    body: body as unknown as BodyInit,
  };
};

const retrieveRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const cfg = ctx.config as unknown as ResponseRetrieveRequest;
  const { base, headers } = resolveRequestBase(ctx);
  const path = resolveApiPath(ctx, {
    default: `${RESPONSES_PATH}/${cfg.response_id}`,
  });
  const qs = buildQuery({
    include: cfg.include,
    include_obfuscation: cfg.include_obfuscation,
    starting_after: cfg.starting_after,
    stream: cfg.stream,
  });
  const url = `${joinPath(base, path ?? RESPONSES_PATH)}${qs}`;
  return {
    url,
    method: "GET",
    headers,
  };
};

const cancelRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const cfg = ctx.config as unknown as ResponseCancelParams;
  const { base, headers } = resolveRequestBase(ctx);
  const path = resolveApiPath(ctx, {
    default: `${RESPONSES_PATH}/${cfg.response_id}/cancel`,
  });
  const url = joinPath(base, path ?? RESPONSES_PATH);
  return {
    url,
    method: "POST",
    headers,
  };
};

const deleteRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const cfg = ctx.config as unknown as ResponseDeleteParams;
  const { base, headers } = resolveRequestBase(ctx);
  const path = resolveApiPath(ctx, {
    default: `${RESPONSES_PATH}/${cfg.response_id}`,
  });
  const url = joinPath(base, path ?? RESPONSES_PATH);
  return {
    url,
    method: "DELETE",
    headers,
  };
};

const compactRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const cfg = ctx.config as unknown as ResponseCompactRequest;
  const { base, headers } = resolveRequestBase(ctx);
  const path =
    resolveApiPath(ctx, {
      default: RESPONSES_COMPACT_PATH,
    }) ?? RESPONSES_COMPACT_PATH;
  const url = joinPath(base, path);
  return {
    url,
    method: "POST",
    headers,
    body: cfg as unknown as BodyInit,
  };
};

const listInputItemsRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const cfg = ctx.config as unknown as ResponseInputItemsListRequest;
  const { base, headers } = resolveRequestBase(ctx);
  const path = resolveApiPath(ctx, {
    default: `${RESPONSES_PATH}/${cfg.response_id}/input_items`,
  });
  const qs = buildQuery({
    include: cfg.include,
    order: cfg.order,
    after: cfg.after,
    limit: cfg.limit,
  });
  const url = `${joinPath(base, path ?? RESPONSES_PATH)}${qs}`;
  return {
    url,
    method: "GET",
    headers,
  };
};

const createHandler: ApiHandler = {
  getRequestConfig: createRequestConfig,
  responseTransformers: [jsonTransformer],
};

const createStreamingHandler: ApiHandler = {
  getRequestConfig: createRequestConfig,
  responseTransformers: [sseTransformer],
};

const retrieveHandler: ApiHandler = {
  getRequestConfig: retrieveRequestConfig,
  responseTransformers: [jsonTransformer],
};

const retrieveStreamingHandler: ApiHandler = {
  getRequestConfig: retrieveRequestConfig,
  responseTransformers: [sseTransformer],
};

const cancelHandler: ApiHandler = {
  getRequestConfig: cancelRequestConfig,
  responseTransformers: [jsonTransformer],
};

const deleteHandler: ApiHandler = {
  getRequestConfig: deleteRequestConfig,
  responseTransformers: [jsonTransformer],
};

const compactHandler: ApiHandler = {
  getRequestConfig: compactRequestConfig,
  responseTransformers: [jsonTransformer],
};

const listInputItemsHandler: ApiHandler = {
  getRequestConfig: listInputItemsRequestConfig,
  responseTransformers: [jsonTransformer],
};

export function getResponsesHandler(ctx: AdapterContext): ApiHandler | null {
  switch (ctx.apiType) {
    case "response.create":
      return ctx.config.stream ? createStreamingHandler : createHandler;
    case "response.retrieve":
      return ctx.config.stream ? retrieveStreamingHandler : retrieveHandler;
    case "response.cancel":
      return cancelHandler;
    case "response.delete":
      return deleteHandler;
    case "response.compact":
      return compactHandler;
    case "response.input_items.list":
      return listInputItemsHandler;
    default:
      return null;
  }
}

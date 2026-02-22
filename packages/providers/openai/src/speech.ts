import type { AdapterContext, ApiHandler, RequestConfig } from "ada-pter";
import {
  arrayBufferTransformer,
  joinPath,
  resolveApiPath,
  sseTransformer,
} from "ada-pter";
import type { SpeechCreateParams } from "ada-pter/types/openai/speech";
import { resolveRequestBase } from "./utils";

const SPEECH_PATH = "/audio/speech";

const buildBody = (
  cfg: SpeechCreateParams,
  model: string,
  streamEnabled: boolean | undefined,
): SpeechCreateParams => {
  const stream_format = streamEnabled ? "sse" : "audio";
  return {
    input: cfg.input,
    model,
    voice: cfg.voice,
    instructions: cfg.instructions,
    response_format: cfg.response_format,
    speed: cfg.speed,
    stream_format,
  } as SpeechCreateParams;
};

type SpeechConfig = SpeechCreateParams & { stream?: boolean };

const getRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const cfg = ctx.config as unknown as SpeechConfig;
  const streamEnabled = Boolean(cfg.stream);
  const { base, headers } = resolveRequestBase(ctx);
  const path = resolveApiPath(ctx, { default: SPEECH_PATH }) ?? SPEECH_PATH;
  const url = joinPath(base, path);
  const body = buildBody(cfg, ctx.model, streamEnabled);

  return {
    url,
    method: "POST",
    headers,
    body: body as unknown as BodyInit,
  };
};

const speechHandler: ApiHandler = {
  getRequestConfig,
  responseTransformers: [arrayBufferTransformer],
};

const streamingSpeechHandler: ApiHandler = {
  getRequestConfig,
  responseTransformers: [sseTransformer],
};

export function getSpeechHandler(ctx: AdapterContext): ApiHandler | null {
  if (ctx.apiType !== "speech") return null;
  return ctx.config.stream ? streamingSpeechHandler : speechHandler;
}

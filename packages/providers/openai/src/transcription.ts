import type { AdapterContext, ApiHandler, RequestConfig } from "ada-pter";
import {
  joinPath,
  jsonTransformer,
  resolveApiPath,
  sseTransformer,
} from "ada-pter";
import type { TranscriptionCreateParamsBase } from "ada-pter/types/openai/transcriptions";
import { resolveRequestBase } from "./utils";

const TRANSCRIPTION_PATH = "/audio/transcriptions";

const appendField = (form: FormData, key: string, value: unknown) => {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((v) => void appendField(form, `${key}[]`, v));
    return;
  }
  form.append(key, value as Blob | string);
};

const buildFormData = (
  cfg: TranscriptionCreateParamsBase,
  model: string,
): FormData => {
  const form = new FormData();
  form.append("file", cfg.file as Blob | string);
  form.append("model", model);
  appendField(form, "chunking_strategy", cfg.chunking_strategy);
  appendField(form, "include", cfg.include);
  appendField(form, "known_speaker_names", cfg.known_speaker_names);
  appendField(form, "known_speaker_references", cfg.known_speaker_references);
  appendField(form, "language", cfg.language);
  appendField(form, "prompt", cfg.prompt);
  appendField(form, "response_format", cfg.response_format);
  appendField(form, "stream", cfg.stream);
  appendField(form, "temperature", cfg.temperature);
  appendField(form, "timestamp_granularities", cfg.timestamp_granularities);
  return form;
};

const getRequestConfig = (ctx: AdapterContext): RequestConfig => {
  const cfg = ctx.config as unknown as TranscriptionCreateParamsBase;
  const { base, headers } = resolveRequestBase(ctx);
  headers.delete("Content-Type");

  const path =
    resolveApiPath(ctx, { default: TRANSCRIPTION_PATH }) ?? TRANSCRIPTION_PATH;
  const url = joinPath(base, path);
  const body = buildFormData(cfg, ctx.model);

  return {
    url,
    method: "POST",
    headers,
    body,
  };
};

const transcriptionHandler: ApiHandler = {
  getRequestConfig,
  responseTransformers: [jsonTransformer],
};

const streamingTranscriptionHandler: ApiHandler = {
  getRequestConfig,
  responseTransformers: [sseTransformer],
};

export function getTranscriptionHandler(
  ctx: AdapterContext,
): ApiHandler | null {
  if (ctx.apiType !== "transcription") return null;
  return ctx.config.stream
    ? streamingTranscriptionHandler
    : transcriptionHandler;
}

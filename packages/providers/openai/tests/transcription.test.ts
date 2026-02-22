import { describe, expect, test } from "bun:test";
import {
  jsonTransformer,
  sseTransformer,
} from "../../../ada-pter/src/transformers";
import { autoProvider } from "../src/completion";

const baseCtx = {
  modelId: "openai/gpt-4o-transcribe",
  providerKey: "openai",
  model: "gpt-4o-transcribe",
  normModel: "gpt-4o-transcribe",
  normProvider: "openai",
  normModelId: "openai/gpt-4o-transcribe",
  request: {},
  response: {},
  state: {},
} as any;

describe("@ada-pter/openai transcription", () => {
  test("returns json handler when stream=false", () => {
    const ctx = {
      ...baseCtx,
      apiType: "transcription",
      config: { stream: false, file: new Blob(["hi"]) },
    } as any;
    const handler = autoProvider.getHandler(ctx);
    expect(handler).not.toBeNull();
    expect(handler!.responseTransformers).toEqual([jsonTransformer]);
  });

  test("returns sse handler when stream=true", () => {
    const ctx = {
      ...baseCtx,
      apiType: "transcription",
      config: { stream: true, file: new Blob(["hi"]) },
    } as any;
    const handler = autoProvider.getHandler(ctx);
    expect(handler).not.toBeNull();
    expect(handler!.responseTransformers).toEqual([sseTransformer]);
  });

  test("getRequestConfig builds FormData without forcing content-type", () => {
    const ctx = {
      ...baseCtx,
      apiType: "transcription",
      config: {
        stream: false,
        file: new Blob(["hi"], { type: "audio/wav" }),
        model: "gpt-4o-transcribe",
        known_speaker_names: ["agent", "customer"],
        language: "en",
      },
    } as any;

    const handler = autoProvider.getHandler(ctx)!;
    const req = handler.getRequestConfig(ctx);

    expect(req.method).toBe("POST");
    expect(req.url.endsWith("/audio/transcriptions")).toBe(true);

    const headers = req.headers as Headers;
    expect(headers.get("Content-Type")).toBeNull();

    const form = req.body as FormData;
    const names = form.getAll("known_speaker_names[]");
    expect(names).toEqual(["agent", "customer"]);
    expect(form.get("model")).toBe("gpt-4o-transcribe");
    expect(form.get("file")).toBeInstanceOf(Blob);
  });
});

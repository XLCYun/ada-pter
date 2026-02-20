import type { ResponseTransformer } from "../types";
import { getResponseContentType, isSseContentType } from "./utils";

// biome-ignore lint/complexity/noBannedTypes: no options for now
export type SseTransformerOptions = {};

const OPENAI_DONE_MARKER = "[DONE]";

function extractSseData(rawEvent: string): string | null {
  const lines = rawEvent.split("\n");
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  return dataLines.join("\n");
}

async function* sseDataIterator(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let shouldStop = false;

  try {
    while (!shouldStop) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const idx = buffer.indexOf("\n\n");
        if (idx === -1) break;

        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const data = extractSseData(rawEvent);
        if (data == null) continue;

        if (data.trim() === OPENAI_DONE_MARKER) {
          shouldStop = true;
          break;
        }

        yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function createSseTransformer(
  _options: SseTransformerOptions = {},
): ResponseTransformer {
  return async (ctx) => {
    const raw = ctx.response.raw;
    if (!raw) return;

    const contentType = getResponseContentType(ctx);
    if (!isSseContentType(contentType)) return;

    const body = raw.body;
    if (!body) {
      ctx.response.data = (async function* () {})();
      return;
    }

    ctx.response.data = (async function* () {
      for await (const data of sseDataIterator(body)) {
        const trimmed = data.trim();
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            yield JSON.parse(trimmed) as unknown;
            continue;
          } catch {
            // fall through
          }
        }
        yield data;
      }
    })();
  };
}

export const sseTransformer: ResponseTransformer = createSseTransformer({});

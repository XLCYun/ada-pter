import type { CompletionChunk, CompletionResponse, StreamingCompletionResult } from "../types";
import { mergeChunks } from "./merge-chunks";

/**
 * Wrap a source AsyncIterable of CompletionChunks into a StreamingCompletionResult.
 *
 * Uses an eager background consumer that starts pulling from the source immediately,
 * regardless of whether the user iterates. This ensures `finalMessage` resolves even
 * when the user only does `await stream.finalMessage` without iterating.
 *
 * Architecture:
 *   source stream → [background consumer] → shared chunks[] → user iterator / finalMessage
 */
export function createStreamingResult(source: AsyncIterable<CompletionChunk>): StreamingCompletionResult {
  const chunks: CompletionChunk[] = [];
  const waiters: Array<() => void> = [];
  let done = false;
  let streamError: Error | null = null;

  // Promise executor runs synchronously, so resolveFinal/rejectFinal are assigned
  // before the background consumer IIFE below could possibly call them.
  let resolveFinal!: (value: CompletionResponse) => void;
  let rejectFinal!: (reason: unknown) => void;
  const finalMessage = new Promise<CompletionResponse>((resolve, reject) => {
    resolveFinal = resolve;
    rejectFinal = reject;
  });

  // Producer-consumer notification: background consumer pushes to chunks[] and
  // calls notify() to wake up the generator (consumer) waiting for more data.
  // The waiters array holds at most one pending resolve at a time (single consumer).
  const notify = (): void => {
    const resolve = waiters.shift();
    if (resolve) resolve();
  };

  // Eager background consumer — starts immediately
  (async () => {
    try {
      for await (const chunk of source) {
        chunks.push(chunk);
        notify();
      }
    } catch (err) {
      streamError = err as Error;
    } finally {
      done = true;
      notify();
      if (streamError) {
        rejectFinal(streamError);
      } else {
        try {
          resolveFinal(mergeChunks(chunks));
        } catch (err) {
          rejectFinal(err);
        }
      }
    }
  })();

  // Generator that reads from the shared buffer
  async function* gen(): AsyncGenerator<CompletionChunk> {
    let i = 0;
    while (true) {
      // Yield all available chunks
      while (i < chunks.length) {
        yield chunks[i++];
      }
      // Check if stream is done
      if (done) {
        if (streamError) throw streamError;
        return;
      }
      // Wait for background consumer to push more data
      await new Promise<void>((resolve) => waiters.push(resolve));
    }
  }

  const result = gen() as unknown as StreamingCompletionResult;
  Object.defineProperty(result, "finalMessage", {
    value: finalMessage,
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return result;
}

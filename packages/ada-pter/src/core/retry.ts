import { ProviderError, TimeoutError } from "../errors";
import type { Middleware, RequestConfig } from "../types/core";

type RetryContext = Parameters<Middleware>[0];
type AttemptResult =
  | { type: "success"; response: Response }
  | { type: "retry" }
  | { type: "throw"; error: unknown };

const RETRYABLE_STATUSES = new Set([
  408, 409, 425, 429, 500, 502, 503, 504, 507, 508, 509, 520, 521, 522, 523,
  524,
]);
const NON_RETRYABLE_STATUSES = new Set([501, 505]);

const isRetryableStatus = (status: number): boolean => {
  if (NON_RETRYABLE_STATUSES.has(status)) return false;
  return RETRYABLE_STATUSES.has(status) || status >= 500;
};

export class RetryController {
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxRetryDelay: number;

  constructor(private readonly ctx: RetryContext) {
    this.maxRetries = Math.max(0, ctx.config.maxRetries ?? 0);
    this.baseDelay = Math.max(0, ctx.config.retryDelay ?? 0);
    this.maxRetryDelay = Math.max(0, ctx.config.maxRetryDelay ?? 0);
  }

  async run(
    request: RequestConfig,
    onSuccess: (response: Response) => Promise<void>,
  ): Promise<void> {
    const { url, ...init } = request;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const isLastAttempt = attempt === this.maxRetries;
      const result = await this.tryAttempt(url, init, attempt, isLastAttempt);

      if (result.type === "success") {
        await onSuccess(result.response);
        return;
      }
      if (result.type === "throw") throw result.error;
    }

    // Defensive fallback: should be unreachable because last attempt must return success or throw.
    throw new Error("Request failed after retries");
  }

  private async tryAttempt(
    url: string,
    init: RequestInit,
    attempt: number,
    isLastAttempt: boolean,
  ): Promise<AttemptResult> {
    try {
      const res = await fetch(url, init);
      this.ctx.response.raw = res;

      if (res.ok) return { type: "success", response: res };

      return this.onHttpFailure(res, attempt, isLastAttempt);
    } catch (err) {
      return this.onError(err, attempt, isLastAttempt);
    }
  }

  private async onHttpFailure(
    res: Response,
    attempt: number,
    isLastAttempt: boolean,
  ): Promise<AttemptResult> {
    const status = res.status;

    // HTTP retries only apply to retryable statuses and before the last attempt.
    if (isLastAttempt || !isRetryableStatus(status)) {
      const bodyText = await res.text();
      const providerName = this.ctx.provider?.name ?? "unknown";
      const providerError = new ProviderError(providerName, status, bodyText);
      return { type: "throw", error: providerError };
    }

    const retryAfterMs =
      status === 429 || status === 503
        ? this.parseRetryAfterMs(res.headers.get("retry-after"))
        : undefined;
    await this.sleepBackoff(attempt, retryAfterMs);
    return { type: "retry" };
  }

  private async onError(
    err: unknown,
    attempt: number,
    isLastAttempt: boolean,
  ): Promise<AttemptResult> {
    const timeoutError = this.toTimeoutError();
    if (timeoutError) return { type: "throw", error: timeoutError };
    // ProviderError/TimeoutError are deterministic failures and should not be retried.
    if (err instanceof ProviderError || err instanceof TimeoutError) {
      return { type: "throw", error: err };
    }
    // Network retries stop on the last attempt or when aborted.
    if (isLastAttempt || this.ctx.signal?.aborted) {
      return { type: "throw", error: err };
    }

    await this.sleepBackoff(attempt);
    return { type: "retry" };
  }

  private isTimeoutAbort(): boolean {
    if (!this.ctx.signal?.aborted) return false;
    const reason = (this.ctx.signal as AbortSignal).reason;
    return (
      (typeof reason === "object" && reason?.name === "TimeoutError") ||
      (typeof reason === "string" && reason.toLowerCase().includes("timeout"))
    );
  }

  private toTimeoutError(): TimeoutError | undefined {
    if (!this.isTimeoutAbort()) return undefined;
    const timeout = this.ctx.config.timeout;
    if (!timeout || !Number.isFinite(timeout)) return undefined;
    return new TimeoutError(timeout);
  }

  private parseRetryAfterMs(header: string | null): number | undefined {
    if (!header) return undefined;
    const trimmed = header.trim();
    if (!trimmed) return undefined;

    const seconds = Number(trimmed);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const dateMs = Date.parse(trimmed);
    if (Number.isNaN(dateMs)) return undefined;

    return Math.max(0, dateMs - Date.now());
  }

  private async sleepBackoff(
    attempt: number,
    retryAfterMs?: number,
  ): Promise<void> {
    const delay =
      retryAfterMs != null
        ? Math.min(retryAfterMs, this.maxRetryDelay)
        : (() => {
            const exp = this.baseDelay * 2 ** attempt;
            const lower = exp * 0.5;
            const jittered = lower + Math.random() * (exp - lower);
            return Math.min(jittered, this.maxRetryDelay);
          })();
    await this.sleepWithSignal(delay, this.ctx.signal);
  }

  private async sleepWithSignal(
    ms: number,
    signal?: AbortSignal,
  ): Promise<void> {
    const abortError = () =>
      signal?.reason ?? new DOMException("Aborted", "AbortError");

    if (signal?.aborted) {
      throw abortError();
    }

    if (ms <= 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timer);
        reject(abortError());
      };

      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}

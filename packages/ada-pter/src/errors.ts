/**
 * Error classes for ada-pter.
 *
 * Kept in a standalone file (not inside types/) because these are runtime
 * classes that survive compilation, unlike pure type definitions.
 *
 * Inheritance: Error -> AdaPterError -> ProviderError / UnsupportedApiError / TimeoutError
 */

/**
 * Base error for all ada-pter errors.
 * Downstream code can catch this single class to handle any framework-level error.
 */
export class AdaPterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdaPterError';
    // Fix prototype chain so `instanceof` works correctly even when
    // compiled down to ES5 (where extending built-ins breaks the chain).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a Provider API returns a non-OK HTTP response.
 * Exposes structured fields (provider, status, body) so that downstream
 * utilities like `isRetryableError` can make decisions without parsing
 * the message string.
 */
export class ProviderError extends AdaPterError {
  readonly provider: string;
  readonly status: number;
  readonly body: string;

  constructor(provider: string, status: number, body: string) {
    super(`[${provider}] HTTP ${status}: ${body}`);
    this.name = 'ProviderError';
    this.provider = provider;
    this.status = status;
    this.body = body;
  }
}

/**
 * Thrown when a Provider does not have a handler registered for the
 * requested API type (e.g. calling `embedding()` on a provider that
 * only supports `completion`).
 */
export class UnsupportedApiError extends AdaPterError {
  readonly provider: string;
  readonly apiType: string;

  constructor(provider: string, apiType: string) {
    super(`Provider "${provider}" does not support API type "${apiType}"`);
    this.name = 'UnsupportedApiError';
    this.provider = provider;
    this.apiType = apiType;
  }
}

/**
 * Thrown when a request exceeds the configured timeout duration.
 * The `timeout` field records the configured limit in milliseconds.
 */
export class TimeoutError extends AdaPterError {
  readonly timeout: number;

  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

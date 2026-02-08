import { describe, test, expect } from 'bun:test';
import {
  AdaPterError,
  ProviderError,
  UnsupportedApiError,
  TimeoutError,
} from '../src/errors';

describe('AdaPterError', () => {
  test('sets message and name correctly', () => {
    const err = new AdaPterError('something went wrong');
    expect(err.message).toBe('something went wrong');
    expect(err.name).toBe('AdaPterError');
  });

  test('is an instance of Error and AdaPterError', () => {
    const err = new AdaPterError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AdaPterError);
  });

  test('has a proper stack trace', () => {
    const err = new AdaPterError('trace');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AdaPterError');
  });
});

describe('ProviderError', () => {
  const err = new ProviderError('openai', 429, 'Rate limit exceeded');

  test('stores provider, status, and body fields', () => {
    expect(err.provider).toBe('openai');
    expect(err.status).toBe(429);
    expect(err.body).toBe('Rate limit exceeded');
  });

  test('formats message as "[provider] HTTP {status}: {body}"', () => {
    expect(err.message).toBe('[openai] HTTP 429: Rate limit exceeded');
  });

  test('sets name to ProviderError', () => {
    expect(err.name).toBe('ProviderError');
  });

  test('instanceof chain: Error -> AdaPterError -> ProviderError', () => {
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AdaPterError);
    expect(err).toBeInstanceOf(ProviderError);
  });

  test('is not instanceof unrelated error classes', () => {
    expect(err).not.toBeInstanceOf(UnsupportedApiError);
    expect(err).not.toBeInstanceOf(TimeoutError);
  });

  test('works with various status codes', () => {
    const err500 = new ProviderError('anthropic', 500, 'Internal Server Error');
    expect(err500.message).toBe('[anthropic] HTTP 500: Internal Server Error');
    expect(err500.status).toBe(500);

    const err401 = new ProviderError('google', 401, 'Unauthorized');
    expect(err401.message).toBe('[google] HTTP 401: Unauthorized');
    expect(err401.status).toBe(401);
  });
});

describe('UnsupportedApiError', () => {
  const err = new UnsupportedApiError('anthropic', 'embedding');

  test('stores provider and apiType fields', () => {
    expect(err.provider).toBe('anthropic');
    expect(err.apiType).toBe('embedding');
  });

  test('formats message correctly', () => {
    expect(err.message).toBe(
      'Provider "anthropic" does not support API type "embedding"',
    );
  });

  test('sets name to UnsupportedApiError', () => {
    expect(err.name).toBe('UnsupportedApiError');
  });

  test('instanceof chain: Error -> AdaPterError -> UnsupportedApiError', () => {
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AdaPterError);
    expect(err).toBeInstanceOf(UnsupportedApiError);
  });

  test('is not instanceof unrelated error classes', () => {
    expect(err).not.toBeInstanceOf(ProviderError);
    expect(err).not.toBeInstanceOf(TimeoutError);
  });
});

describe('TimeoutError', () => {
  const err = new TimeoutError(5000);

  test('stores timeout field', () => {
    expect(err.timeout).toBe(5000);
  });

  test('formats message as "Request timed out after {timeout}ms"', () => {
    expect(err.message).toBe('Request timed out after 5000ms');
  });

  test('sets name to TimeoutError', () => {
    expect(err.name).toBe('TimeoutError');
  });

  test('instanceof chain: Error -> AdaPterError -> TimeoutError', () => {
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AdaPterError);
    expect(err).toBeInstanceOf(TimeoutError);
  });

  test('is not instanceof unrelated error classes', () => {
    expect(err).not.toBeInstanceOf(ProviderError);
    expect(err).not.toBeInstanceOf(UnsupportedApiError);
  });
});

describe('error discrimination via instanceof in try/catch', () => {
  test('can distinguish ProviderError from other errors', () => {
    try {
      throw new ProviderError('openai', 500, 'Server error');
    } catch (err) {
      expect(err).toBeInstanceOf(AdaPterError);
      expect(err).toBeInstanceOf(ProviderError);
      if (err instanceof ProviderError) {
        expect(err.status).toBe(500);
        expect(err.provider).toBe('openai');
      }
    }
  });

  test('can distinguish UnsupportedApiError from ProviderError', () => {
    const errors: Error[] = [
      new ProviderError('openai', 400, 'Bad request'),
      new UnsupportedApiError('openai', 'audio.speech'),
      new TimeoutError(3000),
    ];

    const providerErrors = errors.filter((e) => e instanceof ProviderError);
    const unsupportedErrors = errors.filter((e) => e instanceof UnsupportedApiError);
    const timeoutErrors = errors.filter((e) => e instanceof TimeoutError);
    const adapterErrors = errors.filter((e) => e instanceof AdaPterError);

    expect(providerErrors).toHaveLength(1);
    expect(unsupportedErrors).toHaveLength(1);
    expect(timeoutErrors).toHaveLength(1);
    expect(adapterErrors).toHaveLength(3); // all three are AdaPterError
  });
});

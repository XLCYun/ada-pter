import { describe, test, expect } from 'bun:test';
import { deepMerge, extractConfig } from '../src/core/config';

// ─── deepMerge ──────────────────────────────────────────────────────────────

describe('deepMerge', () => {
  test('merges flat objects (later overrides earlier)', () => {
    const result = deepMerge(
      { timeout: 5000, maxRetries: 3 },
      { timeout: 10000 },
    );
    expect(result).toEqual({ timeout: 10000, maxRetries: 3 });
  });

  test('three-level merge: global > API-level > call-level', () => {
    const global = { timeout: 5000, maxRetries: 3, retryDelay: 1000 };
    const apiLevel = { timeout: 10000 };
    const callLevel = { temperature: 0.7 };

    const result = deepMerge(global, apiLevel, callLevel);
    expect(result).toEqual({
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      temperature: 0.7,
    });
  });

  test('deep-merges nested plain objects', () => {
    const result = deepMerge(
      { providers: { openai: { apiKey: 'sk-old', baseURL: 'https://api.openai.com' } } },
      { providers: { openai: { apiKey: 'sk-new' }, anthropic: { apiKey: 'ant-key' } } },
    );
    expect(result).toEqual({
      providers: {
        openai: { apiKey: 'sk-new', baseURL: 'https://api.openai.com' },
        anthropic: { apiKey: 'ant-key' },
      },
    });
  });

  test('arrays are replaced entirely (not concatenated)', () => {
    const result = deepMerge(
      { fallbackModels: ['model-a', 'model-b'] },
      { fallbackModels: ['model-c'] },
    );
    expect(result).toEqual({ fallbackModels: ['model-c'] });
  });

  test('undefined sources are skipped', () => {
    const result = deepMerge(
      { timeout: 5000 },
      undefined,
      { maxRetries: 2 },
      undefined,
    );
    expect(result).toEqual({ timeout: 5000, maxRetries: 2 });
  });

  test('null sources are skipped', () => {
    const result = deepMerge(
      { timeout: 5000 },
      null as unknown as Record<string, unknown> | undefined,
    );
    expect(result).toEqual({ timeout: 5000 });
  });

  test('returns empty object when all sources are undefined', () => {
    const result = deepMerge(undefined, undefined);
    expect(result).toEqual({});
  });

  test('returns empty object when no sources are provided', () => {
    const result = deepMerge();
    expect(result).toEqual({});
  });

  test('primitive values overwrite nested objects', () => {
    const result = deepMerge(
      { providers: { openai: { apiKey: 'sk-123' } } },
      { providers: 'disabled' as unknown as Record<string, unknown> },
    );
    expect(result).toEqual({ providers: 'disabled' });
  });

  test('nested objects overwrite primitive values', () => {
    const result = deepMerge(
      { providers: 'disabled' as unknown as Record<string, unknown> },
      { providers: { openai: { apiKey: 'sk-123' } } },
    );
    expect(result).toEqual({ providers: { openai: { apiKey: 'sk-123' } } });
  });

  test('functions are overwritten (not merged)', () => {
    const fn1 = () => {};
    const fn2 = () => {};
    const result = deepMerge(
      { onFallback: fn1 },
      { onFallback: fn2 },
    );
    expect(result.onFallback).toBe(fn2);
  });

  test('does not mutate source objects', () => {
    const source1 = { providers: { openai: { apiKey: 'sk-old' } } };
    const source2 = { providers: { openai: { model: 'gpt-4' } } };

    const source1Copy = JSON.parse(JSON.stringify(source1));
    const source2Copy = JSON.parse(JSON.stringify(source2));

    deepMerge(source1, source2);

    expect(source1).toEqual(source1Copy);
    expect(source2).toEqual(source2Copy);
  });

  test('handles deeply nested objects (3+ levels)', () => {
    const result = deepMerge(
      { a: { b: { c: { d: 1, e: 2 } } } },
      { a: { b: { c: { d: 3, f: 4 } } } },
    );
    expect(result).toEqual({ a: { b: { c: { d: 3, e: 2, f: 4 } } } });
  });

  test('null field values overwrite existing values', () => {
    const result = deepMerge(
      { timeout: 5000 },
      { timeout: null as unknown as number },
    );
    expect(result.timeout).toBeNull();
  });

  test('non-plain objects (Date, RegExp) are treated as atomic values', () => {
    const date = new Date('2025-01-01');
    const regex = /test/;
    const result = deepMerge(
      { a: { date: new Date('2020-01-01') } },
      { a: { date, regex } },
    );
    expect((result as any).a.date).toBe(date);
    expect((result as any).a.regex).toBe(regex);
  });

  test('single source returns a shallow copy', () => {
    const source = { timeout: 5000, providers: { openai: { apiKey: 'sk' } } };
    const result = deepMerge(source);
    expect(result).toEqual(source);
    // Top-level should be a different object
    expect(result).not.toBe(source);
  });
});

// ─── extractConfig ──────────────────────────────────────────────────────────

describe('extractConfig', () => {
  test('extracts known config keys from params', () => {
    const params = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.7,
      timeout: 5000,
    };

    const { config, rest } = extractConfig(params);

    expect(config).toEqual({ temperature: 0.7, timeout: 5000 });
    expect(rest).toEqual({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'hello' }],
    });
  });

  test('returns empty config when no config keys are present', () => {
    const params = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'hello' }],
    };

    const { config, rest } = extractConfig(params);

    expect(config).toEqual({});
    expect(rest).toEqual(params);
  });

  test('returns empty rest when all keys are config keys', () => {
    const params = {
      timeout: 5000,
      temperature: 0.5,
      maxTokens: 100,
      maxRetries: 2,
      retryDelay: 500,
    };

    const { config, rest } = extractConfig(params);

    expect(config).toEqual(params);
    expect(rest).toEqual({});
  });

  test('extracts all known config keys', () => {
    const onFallback = () => {};
    const params = {
      model: 'gpt-4',
      timeout: 5000,
      temperature: 0.7,
      maxTokens: 100,
      maxRetries: 2,
      retryDelay: 500,
      fallbackModels: ['model-b'],
      onFallback,
      providers: { openai: { apiKey: 'sk-123' } },
    };

    const { config, rest } = extractConfig(params);

    expect(config).toEqual({
      timeout: 5000,
      temperature: 0.7,
      maxTokens: 100,
      maxRetries: 2,
      retryDelay: 500,
      fallbackModels: ['model-b'],
      onFallback,
      providers: { openai: { apiKey: 'sk-123' } },
    });
    expect(rest).toEqual({ model: 'gpt-4' });
  });

  test('skips undefined config values', () => {
    const params = {
      model: 'gpt-4',
      temperature: undefined,
      timeout: 5000,
    };

    const { config, rest } = extractConfig(params);

    // temperature is undefined → excluded from config
    expect(config).toEqual({ timeout: 5000 });
    // temperature with undefined is also excluded from rest (it's a config key)
    expect(rest).toEqual({ model: 'gpt-4' });
  });

  test('handles empty params object', () => {
    const { config, rest } = extractConfig({});
    expect(config).toEqual({});
    expect(rest).toEqual({});
  });

  test('does not mutate the original params', () => {
    const params = {
      model: 'gpt-4',
      temperature: 0.7,
      messages: [{ role: 'user', content: 'hi' }],
    };
    const paramsCopy = { ...params };

    extractConfig(params);

    expect(params).toEqual(paramsCopy);
  });

  test('preserves non-config keys with various value types', () => {
    const messages = [{ role: 'user', content: 'hello' }];
    const params = {
      model: 'gpt-4',
      messages,
      stream: true,
      customField: { nested: true },
      temperature: 0.8,
    };

    const { config, rest } = extractConfig(params);

    expect(config).toEqual({ temperature: 0.8 });
    expect(rest).toEqual({
      model: 'gpt-4',
      messages,
      stream: true,
      customField: { nested: true },
    });
  });

  test('config value of 0 is extracted (not treated as falsy)', () => {
    const params = { model: 'gpt-4', temperature: 0, maxRetries: 0 };

    const { config, rest } = extractConfig(params);

    expect(config).toEqual({ temperature: 0, maxRetries: 0 });
    expect(rest).toEqual({ model: 'gpt-4' });
  });

  test('config value of null is extracted', () => {
    const params = { model: 'gpt-4', timeout: null };

    const { config, rest } = extractConfig(params as Record<string, unknown>);

    expect(config).toEqual({ timeout: null });
    expect(rest).toEqual({ model: 'gpt-4' });
  });
});

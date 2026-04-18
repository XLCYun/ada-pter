import type { AdapterContext } from "../types";

export interface ResolveApiKeyOptions {
  envName?: string;
}

export interface ResolveApiBaseOptions {
  envName?: string;
  default?: string;
}

export interface ResolveApiPathOptions {
  default?: string;
}

const getEnv = (name: string): string | undefined => {
  if (typeof process === "undefined") return undefined;
  const val = process.env[name];
  return val === "" ? undefined : val;
};

const resolveConfigValue = (ctx: AdapterContext, key: "apiKey" | "apiBase" | "apiPath"): string | undefined => {
  const val = ctx.config[key];
  return typeof val === "function" ? val(ctx) : val;
};

export const resolveApiKey = (ctx: AdapterContext, opts: ResolveApiKeyOptions = {}): string | undefined =>
  resolveConfigValue(ctx, "apiKey") ?? (opts.envName ? getEnv(opts.envName) : undefined);

export const resolveApiBase = (ctx: AdapterContext, opts: ResolveApiBaseOptions = {}): string | undefined =>
  resolveConfigValue(ctx, "apiBase") ?? (opts.envName ? getEnv(opts.envName) : undefined) ?? opts.default;

export const resolveApiPath = (ctx: AdapterContext, opts: ResolveApiPathOptions = {}): string | undefined =>
  resolveConfigValue(ctx, "apiPath") ?? opts.default;

import type { AdapterContext } from "../types";

export function getContentType(headers?: Headers): string {
  const ct = headers?.get("content-type") ?? "";
  return ct.split(";")[0].trim().toLowerCase();
}

export function getResponseContentType(ctx: AdapterContext): string {
  const raw = ctx.response.raw;
  return getContentType(raw?.headers);
}

export function isJsonContentType(contentType: string): boolean {
  return contentType === "application/json";
}

export function hasJsonContentType(headers?: Headers): boolean {
  if (!headers) return false;
  return isJsonContentType(getContentType(headers));
}

export function isSseContentType(contentType: string): boolean {
  return contentType.startsWith("text/event-stream");
}

import type { AdapterContext } from "../types";

export function getContentType(ctx: AdapterContext): string {
  const raw = ctx.response.raw;
  const ct = raw?.headers.get("content-type") ?? "";
  return ct.split(";")[0].trim().toLowerCase();
}

export function isJsonContentType(contentType: string): boolean {
  if (!contentType) return false;
  return contentType === "application/json";
}

export function isSseContentType(contentType: string): boolean {
  return contentType.startsWith("text/event-stream");
}

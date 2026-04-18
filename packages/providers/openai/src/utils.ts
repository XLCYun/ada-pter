import type { AdapterContext } from "@ada-pter/core";
import { resolveApiBase, resolveApiKey } from "@ada-pter/core";
import { OPENAI_BASE } from "./common";

export function resolveRequestBase(ctx: AdapterContext): {
  base: string;
  headers: Headers;
} {
  const apiKey = resolveApiKey(ctx, { envName: "OPENAI_API_KEY" });
  const base =
    resolveApiBase(ctx, {
      envName: "OPENAI_BASE_URL",
      default: OPENAI_BASE,
    }) ?? "";

  if (!base) {
    throw new Error("No base URL provided");
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Content-Type", "application/json");

  return { base, headers };
}

import type { ChatCompletionCreateParamsWebSearchOptions } from "ada-pter/types/openai";
import type { UserLocation, WebSearchTool20250305 } from "./types/messages";

const WEB_SEARCH_TOOL_MAX_USES: Record<"low" | "medium" | "high", number> = {
  low: 1,
  medium: 5,
  high: 10,
};

/**
 * Maps OpenAI web_search_options to Anthropic web_search tool (type web_search_20250305).
 * When web_search_options is present, the caller should append the returned tool to the tools list.
 */
export function mapWebSearchTool(options: ChatCompletionCreateParamsWebSearchOptions): WebSearchTool20250305 {
  const tool: WebSearchTool20250305 = {
    type: "web_search_20250305",
    name: "web_search",
  };

  const approx = options.user_location?.approximate;
  if (approx != null && typeof approx === "object") {
    const userLocation: UserLocation = {
      type: "approximate",
    };
    if (approx.city != null) userLocation.city = approx.city;
    if (approx.country != null) userLocation.country = approx.country;
    if (approx.region != null) userLocation.region = approx.region;
    if (approx.timezone != null) userLocation.timezone = approx.timezone;
    tool.user_location = userLocation;
  }

  const size = options.search_context_size;
  if (size != null && (size === "low" || size === "medium" || size === "high")) {
    tool.max_uses = WEB_SEARCH_TOOL_MAX_USES[size];
  }

  return tool;
}

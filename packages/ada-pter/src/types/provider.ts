import type { AdapterContext, ApiType } from './core';

/**
 * Provider adapter — a pure configuration object (not a middleware function).
 * Created via defineProvider() and registered to the routing table via adapter.use().
 */
export interface ProviderAdapter {
  /** Unique provider identifier, e.g. 'openai', 'anthropic'.
   *  Used for prefix-based route matching ("openai" in "openai/gpt-4") and in log/error messages. */
  name: string;

  /** List of model matching rules for this provider. Iterated during adapter-level routing.
   *  - string: exact match (e.g. 'gpt-4')
   *  - RegExp: regex match (e.g. /^gpt-/)
   *  - function: custom match logic (e.g. model => model.startsWith('custom-')) */
  models: Array<string | RegExp | ((model: string) => boolean)>;

  /** Returns common HTTP headers for all APIs of this provider (primarily auth).
   *  e.g. { Authorization: 'Bearer sk-xxx' }. Can be overridden by handler-level getHeaders. */
  getHeaders(ctx: AdapterContext): Record<string, string>;

  /** Handler map registered by API type. Only needs to implement the API types this provider supports;
   *  unsupported types can be omitted (executor throws UnsupportedApiError when not found). */
  handlers: Partial<Record<ApiType, ApiHandler>>;
}

/**
 * Handler for a single API type. Tells the executor "where to send the request
 * and how to transform request/response".
 * For 90% of cases, only getEndpoint + transformRequest + transformResponse are needed;
 * the executor handles fetch/SSE/error handling. Use customExecute for full control in special cases.
 */
export interface ApiHandler {
  /** Returns the request URL for this API, e.g. 'https://api.openai.com/v1/chat/completions'.
   *  Can be dynamically constructed based on ctx (e.g. different models use different endpoints). */
  getEndpoint(ctx: AdapterContext): string;

  /** Optional: override provider-level headers. For cases where a specific API requires extra headers.
   *  Return value is merged with provider.getHeaders() result (handler-level takes precedence). */
  getHeaders?(ctx: AdapterContext): Record<string, string>;

  /** Transforms unified request parameters from ctx into the provider's API request body.
   *  Return value is JSON.stringify'd and used as the fetch body. */
  transformRequest(ctx: AdapterContext): unknown;

  /** Transforms the provider API's raw JSON response into the unified response format.
   *  `raw` is the result of await res.json(). Return value is stored in ctx.response. */
  transformResponse(raw: unknown): unknown;

  /** Optional: stream chunk transformer. Converts a raw SSE data line string into a unified chunk format.
   *  Return null to skip the chunk (e.g. heartbeat packets).
   *  When not provided, the core's default OpenAI SSE JSON parser is used. */
  transformStreamChunk?(raw: string): unknown | null;

  /** Optional: fully take over execution, bypassing the core's default fetch flow.
   *  For special cases: multipart/form-data, SDK calls, non-JSON responses, etc.
   *  Contract: non-streaming must set ctx.response; streaming must set ctx.streamResult. */
  customExecute?(ctx: AdapterContext): Promise<void>;
}

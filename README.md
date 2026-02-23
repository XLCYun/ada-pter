<div align="center">

# 🔌 ada-pter

**The Universal, Type-Safe LLM Adapter for TypeScript**

[![npm version](https://img.shields.io/npm/v/ada-pter.svg?style=flat-square)](https://www.npmjs.com/package/ada-pter)
[![codecov](https://codecov.io/gh/XLCYun/ada-pter/branch/main/graph/badge.svg?style=flat-square)](https://codecov.io/gh/XLCYun/ada-pter)
[![CI Build](https://img.shields.io/github/actions/workflow/status/XLCYun/ada-pter/unit-tests.yml?branch=main&style=flat-square)](https://github.com/XLCYun/ada-pter/actions/workflows/unit-tests.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)

English | [简体中文](./README_zh.md)

*If you find this project useful, please consider giving it a ⭐ on GitHub!*

</div>

`ada-pter` is a TypeScript implementation inspired by litellm, built around a powerful Koa-style middleware engine. It provides a unified, cross-platform API to interact with multiple LLM providers, while maintaining a lean core and offloading provider-specific logic to on-demand plugins.

## ✨ Key Features

- 🔌 **Framework + Plugins**: The core engine is lightweight. You only install the LLM providers you actually need (e.g., `@ada-pter/openai`).
- 🧅 **Onion Model Middlewares**: Easily intercept requests and responses. The core is lean, flexible, and highly reusable. A single request flows through a Koa-style middleware stack.
- 🔀 **Flexible Routing**: Use the `route` pattern to configure providers dynamically, and `autoRoute` for fallback.
- 🔄 **Multi-Provider Fallback**: Automatically switch to backup models or providers if a request fails, ensuring high availability.
- ⚙️ **4-Level Configuration**: Highly flexible configuration hierarchy (Global Default -> Adapter Level -> API Level -> Request Level).
- 🛡️ **Type-Safe**: Built from the ground up with TypeScript, ensuring excellent autocomplete and strict type safety across all APIs.
- ✅ **100% Test Coverage**: The core engine and all official providers are rigorously unit-tested to guarantee production-level reliability.
- 🌍 **Universal & Zero Dependencies**: The core package relies exclusively on native web APIs (`Promise`, `AsyncIterable`, `fetch`, `AbortController`) without any heavy dependencies.
- 📡 **SSE Streaming**: Native support for Server-Sent Events (SSE) streaming responses, making it easy to handle real-time output.
- 🎯 **Multi-Modal**: A single, unified pipeline for Text Completions, Embeddings, Audio (Speech/Transcription), and Image Generation. (More providers and API methods are actively being developed and will be released soon!)
- 🔁 **Built-in Request-Level Retry Controller**: Comes with built-in retry behavior, including retryable status handling, exponential backoff with jitter, `Retry-After` parsing, and max retry delay control.
- ⏱️ **Built-in Timeout + Signal Cancellation**: Supports both `timeout` and custom `signal`, then composes them into a single runtime cancellation signal for request execution.

## 📦 Installation

Install the core package and your desired provider(s).

```bash
# Using bun
bun add ada-pter @ada-pter/openai

# Using npm
npm install ada-pter @ada-pter/openai

# Using pnpm
pnpm add ada-pter @ada-pter/openai

# Using yarn
yarn add ada-pter @ada-pter/openai
```

## 🚀 Quick Start

Here is a minimal example showing how to use the default exported `adapter`. Under the hood, it uses `autoRoute` which will automatically infer and load the required provider (like `@ada-pter/openai` or any OpenAI-compatible provider) based on the model name you provide!

```typescript
import { adapter } from "ada-pter";

// Make a unified API call (automatically uses the inferred provider)
const response = await adapter.completion({
  model: "gpt-4o", // You can use "gpt-4o", "openai/gpt-4o", etc.
  messages: [{ role: "user", content: "Hello, world!" }],
});

console.log(response.choices[0].message.content);
```

### SSE Streaming

```typescript
import { adapter } from "ada-pter";

// Use streaming output
const stream = await adapter.completion({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Write a poem about programming" }],
  stream: true,
});

// Process the streaming response chunk by chunk
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
```

## 🔄 Auto Fallback

When the primary model request fails, `ada-pter` supports automatic fallback to backup models, ensuring high service availability.

```typescript
import { adapter } from "ada-pter";

// The model field supports an array - models are tried in order, falling back on failure
const response = await adapter.completion({
  model: ["gpt-5", "gpt-4o"],  // Falls back to gpt-4o when gpt-5 fails
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);
```

## 🏗️ Architecture Design

Below is the core processing flow for a single `ada-pter` request (e.g., `completion`):

```mermaid
flowchart TB
  A[Initiate request<br/>e.g. completion] --> B[Merge config and request params]
  B --> C[Provider routing<br/>resolve Provider and Handler]
  C --> E
  subgraph D[Middleware Stack]
    E[Middleware (before request)] --> F[fetch request]
    F --> G[Middleware (after response)]
  end
```

## 🔀 Flexible Routing

`ada-pter` uses a routing system to match requests to the appropriate provider. You can configure routes in two main ways:

### 1. Condition-Based Routing (`route`)
Map a specific condition to a provider instance. You can match by `provider`, `model` (the stripped name), or `modelId` (the full `provider/model` string).

```typescript
import { adapter } from "ada-pter";
import { autoProvider as openAiProvider } from "@ada-pter/openai";

// Match by provider prefix (e.g. catches "openai/gpt-4o")
adapter.route({ provider: "openai" }, openAiProvider);

// Match by the stripped model name (e.g. catches "my-provider/gpt-4")
adapter.route({ model: "gpt-4" }, openAiProvider);

// Match by the exact full modelId
adapter.route({ modelId: "openai/o1-mini" }, openAiProvider);

// Or use a custom resolver function. 
// The context (ctx) gives you access to the apiType, request payload, etc.
adapter.route((ctx) => {
  // E.g., route all image generation requests to a specific provider instance
  if (ctx.apiType === "image.generation") {
    return openAiProvider;
  }
  return null; // Skip to next route
});
```

### 2. Auto-Routing (`autoRoute`)
A powerful automatic inference mechanism. If no explicit route matches, `autoRoute` will automatically try to load the required provider package based on the model name. It is smart enough to infer the provider even without prefixes for common models (e.g., passing `"gpt-5"` will automatically recognize and use the `@ada-pter/openai` provider). The default exported `adapter` instance has `autoRoute` enabled by default.

```typescript
// For custom AdaPter instances, enable auto-routing at the end of your configuration
const myAdapter = new AdaPter().autoRoute();

// Now this will automatically load @ada-pter/openai under the hood!
await myAdapter.completion({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hi" }]
});
```

## 🛠️ Easy Extensibility (Custom Providers)

`ada-pter` is designed to be extremely easy to extend. You can define your own provider to take over specific requests, mock responses, or integrate internal company models.

```typescript
import { adapter, defineProvider, jsonTransformer, sseTransformer, type ApiHandler } from "ada-pter";

// 1. Define a custom provider
const myCustomProvider = defineProvider({
  name: "my-custom",
  getHandler: (ctx) => {
    if (ctx.apiType === "completion") {
      const handler: ApiHandler = {
        getRequestConfig: (ctx) => ({
          url: "https://my-api.example.com/v1/chat/completions",
          method: "POST",
        }),
        // Use built-in transformers that auto-handle based on response content-type
        responseTransformers: [jsonTransformer, sseTransformer],
      };
      return handler;
    }
    return null; // Unsupported apiType
  }
});

// 2. Route specific requests to your custom provider
adapter.route({ model: "my-internal-model" }, myCustomProvider);

// 3. Make the call
const response = await adapter.completion({
  model: "my-internal-model",
  messages: [{ role: "user", content: "Hello" }]
});

console.log(response.choices[0].message.content); // "Response from custom provider!"
```

## ⚙️ 4-Level Configuration

`ada-pter` features a highly flexible, cascading configuration system. Settings merge in the following order (from lowest to highest priority):

1. **Global Default Config**: The built-in framework defaults, which can be modified directly on the exported `defaults` object.
2. **Adapter-Level Config**: Applied to every request on a specific adapter instance via `adapter.configure(config)`.
3. **API-Level Config**: Applied only to specific API types (e.g., only completions) via `adapter.configure(apiType, config)`.
4. **Request-Level Config**: Passed directly into the specific method call (e.g., `adapter.completion({ ... })`).

### Configuration Examples

```typescript
import { adapter, defaults } from "ada-pter";

// 1. Modify the global default configuration
defaults.maxRetries = 2;

// 2. Set an adapter-level configuration
adapter.configure({
  timeout: 5000,
});

// 3. Set an API-level configuration
adapter.configure("completion", {
  stream: true, // Make all completions stream by default
  model: "openai/gpt-4o"
});

// 4. Override at the request level
await adapter.completion({
  model: "openai/gpt-3.5-turbo", // Overrides the API-level model
  stream: false,                 // Overrides the API-level stream setting
  messages: [{ role: "user", content: "Override test" }]
});
```

## 🔁 Built-in Request-Level Retry Controller

`ada-pter` has a built-in request-level retry mechanism. You can control retries and backoff behavior via config; retryable failures (such as some 5xx and 429 responses) are retried automatically.

```typescript
import { adapter } from "ada-pter";

const response = await adapter.completion({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Please summarize today's meeting" }],
  maxRetries: 3,      // Set max retry attempts
  retryDelay: 300,    // Set base backoff delay (ms)
  maxRetryDelay: 2000 // Set max delay per retry (ms)
});

console.log(response.choices[0].message.content);
```

## ⏱️ Built-in Timeout + Signal Cancellation

You can use `timeout` together with a custom `signal`. The framework composes both into a single cancellation signal so requests are stopped promptly on timeout or external abort.

```typescript
import { adapter } from "ada-pter";

const controller = new AbortController();

// Example: cancel from business logic after 800ms
setTimeout(() => controller.abort("cancelled by user"), 800);

const result = await adapter.completion({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Write a short product intro" }],
  timeout: 5000, // framework timeout (ms)
  signal: controller.signal,
});

console.log(result.choices[0].message.content);
```

## 🧅 The "Onion" Middleware Model

The true power of `ada-pter` lies in its middleware engine. Requests and responses flow through a middleware stack (similar to Koa), allowing you to easily inject cross-cutting concerns.

```typescript
import { AdaPter, type Middleware } from "ada-pter";
import { autoProvider as openAiProvider } from "@ada-pter/openai";

// A simple logging middleware
const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  console.log(`[Request] Model: ${ctx.config.model}`);
  
  // Pass control to the next middleware (or the provider)
  await next();
  
  const ms = Date.now() - start;
  console.log(`[Response] Status: ${ctx.response?.status} - Took ${ms}ms`);
};

const adapter = new AdaPter()
  .use(logger)
  .route({ provider: "openai" }, openAiProvider);
```

You can use middlewares to implement:
- Response caching to save costs and reduce latency.
- Custom retry logic with exponential backoff.
- Request validation and payload transformation.
- Detailed metrics and observability.

## 🤝 Supported Providers & Capabilities

| Capability | Supported APIs |
| :--- | :--- |
| **Completions** | Chat completions (streaming & non-streaming) |
| **Embeddings** | Text representations |
| **Audio** | Speech generation (TTS), Transcription (STT) |
| **Images** | Image generation |
| **Responses** | `response.create`, `response.retrieve`, `response.cancel`, `response.delete`, `response.compact`, `response.input_items.list` (including streaming and non-streaming scenarios) |

### Current Providers
- **OpenAI** (`@ada-pter/openai`)
- *Anthropic (`@ada-pter/anthropic`) - Coming soon*

## 🏗️ Project Architecture (Monorepo)

`ada-pter` is maintained as a Bun workspace monorepo. This structure keeps the core entirely decoupled from specific integrations.

- `packages/ada-pter`: The core middleware engine, types, and utility functions.
- `packages/providers/*`: Official LLM provider adapters.
- `packages/middlewares/*`: Optional, pre-built middlewares (e.g., logger).
- `packages/integrations/*`: Optional integrations (e.g., RxJS bindings).

We welcome community contributions! Feel free to open issues or submit Pull Requests for new providers or features.

## 📄 License

This project is licensed under the [Apache-2.0 License](./LICENSE).

## Test

- Unit tests (default):

```bash
bun test
```

Equivalent:

```bash
bun run test:unit
```

- Live API tests (real provider requests, optional):

```bash
cp .env.example .env
# fill OPENAI_API_KEY in .env
RUN_LIVE_TESTS=true bun run test:live
```

Notes:

- Live tests are skipped unless both `RUN_LIVE_TESTS=true` and `OPENAI_API_KEY` are set.
- Live tests may incur API cost.
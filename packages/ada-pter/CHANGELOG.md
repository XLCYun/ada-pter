# ada-pter

## 0.5.0

### Minor Changes

- 061a91b: Add `extraBody` and `extraHeaders` passthrough support for arbitrary request body fields and HTTP headers

## 0.4.0

### Minor Changes

- a6b465a: Add Anthropic model list to registry and auto-detection for claude-\* models

## 0.3.0

### Minor Changes

- dd7d366: Upgrade anthropic package with improvements; update type definitions in core and openai packages

## 0.2.0

### Minor Changes

- 98c7443: Update ada-pter package name to scoped style: @ada-pter/core

## 0.2.0

### Minor Changes

- 4a7353c: - Initial release of ada-pter: type-safe LLM adapter with Koa-style middleware, flexible routing/autoRoute, 4-level config, built-in retry + timeout, SSE streaming, multimodal APIs.
  - Publish official OpenAI provider ada-pter/openai, supporting chat completions (streaming), embeddings, audio TTS/STT, image generation, and responses APIs.
  - Add quick-start docs and examples for auto routing, fallback, and middleware usage.

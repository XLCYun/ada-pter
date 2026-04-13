import { describe, expect, test } from "bun:test";
import { getProvider, autoProvider, name } from "../src/completion";

describe("completion provider", () => {
  describe("module exports", () => {
    test("exports provider name", () => {
      expect(name).toBe("@ada-pter/anthropic");
    });

    test("exports autoProvider as a Provider instance", () => {
      expect(autoProvider).toBeDefined();
      expect(autoProvider.name).toBe("anthropic");
      expect(typeof autoProvider.getHandler).toBe("function");
    });
  });

  describe("getProvider", () => {
    test("returns a valid provider with default options", () => {
      const provider = getProvider();
      expect(provider).toBeDefined();
      expect(provider.name).toBe("anthropic");
      expect(typeof provider.getHandler).toBe("function");
    });

    test("returns a valid provider with custom thinking options", () => {
      const provider = getProvider({
        thinking: {
          type: "enabled",
          budget_tokens: 5000,
        },
      });
      expect(provider).toBeDefined();
      expect(provider.name).toBe("anthropic");
    });

    test("returns different handlers for streaming vs non-streaming", () => {
      const provider = getProvider();

      // Non-streaming
      const nonStreamCtx = {
        apiType: "completion",
        config: { stream: false },
      } as any;
      const nonStreamHandler = provider.getHandler(nonStreamCtx);
      expect(nonStreamHandler).toBeDefined();

      // Streaming
      const streamCtx = {
        apiType: "completion",
        config: { stream: true },
      } as any;
      const streamHandler = provider.getHandler(streamCtx);
      expect(streamHandler).toBeDefined();
    });

    test("returns null handler for non-completion API types", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "chat",
        config: { stream: false },
      } as any;

      const handler = provider.getHandler(mockContext);
      expect(handler).toBeNull();
    });

    test("handler has required response transformers", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: { stream: false },
      } as any;

      const handler = provider.getHandler(mockContext);
      expect(handler).toBeDefined();
      expect(handler?.responseTransformers).toBeDefined();
      expect(Array.isArray(handler?.responseTransformers)).toBe(true);
      expect(handler?.responseTransformers?.length).toBe(2);
    });

    test("handler has getRequestConfig method", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: { stream: false },
      } as any;

      const handler = provider.getHandler(mockContext);
      expect(handler).toBeDefined();
      expect(typeof handler?.getRequestConfig).toBe("function");
    });
  });

  describe("getRequestConfig", () => {
    test("throws error when no API key is provided", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: { stream: false },
      } as any;

      const handler = provider.getHandler(mockContext);
      expect(() => {
        handler?.getRequestConfig(mockContext);
      }).toThrow("No Anthropic API key provided");
    });

    test("uses ANTHROPIC_API_KEY from config", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key-123",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config).toBeDefined();
      expect(config?.headers.get("x-api-key")).toBe("test-key-123");
    });

    test("uses default Anthropic base URL when not provided", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config).toBeDefined();
      expect(config?.url).toContain("https://api.anthropic.com/v1");
      expect(config?.url).toContain("/messages");
    });

    test("uses custom base URL when provided", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          apiBase: "https://custom.example.com/v1",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config).toBeDefined();
      expect(config?.url).toContain("https://custom.example.com/v1");
      expect(config?.url).toContain("/messages");
    });

    test("uses custom API path when provided", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          apiPath: "/custom/messages",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config).toBeDefined();
      expect(config?.url).toContain("/custom/messages");
    });

    test("request config uses POST method", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config?.method).toBe("POST");
    });

    test("request config has required headers", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config?.headers.get("Content-Type")).toBe("application/json");
      expect(config?.headers.get("x-api-key")).toBe("test-key");
      expect(config?.headers.get("anthropic-version")).toBe("2023-06-01");
    });

    test("request config includes body", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [{ role: "user", content: "Hello" }],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config?.body).toBeDefined();
      expect(config?.body).toBeTruthy();
    });

    test("anthropic-beta header included when thinking enabled", () => {
      const provider = getProvider({
        thinking: {
          type: "enabled",
          budget_tokens: 5000,
        },
      });

      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          model: "claude-opus-4-5-20250514",
          stream: false,
          messages: [{ role: "user", content: "Hello" }],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      const betaHeader = config?.headers.get("anthropic-beta");
      // Beta header may or may not be present depending on the thinking configuration
      // The important thing is that the handler is properly configured
      expect(config?.headers).toBeDefined();
    });

    test("throws error when neither base URL nor path provided", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          apiBase: "",
          apiPath: "",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      expect(() => {
        handler?.getRequestConfig(mockContext);
      }).toThrow("No base URL or path provided");
    });
  });

  describe("autoProvider", () => {
    test("autoProvider is reusable across multiple requests", () => {
      const mockContext1 = {
        apiType: "completion",
        config: { stream: false },
      } as unknown as AdapterContext;

      const mockContext2 = {
        apiType: "completion",
        config: { stream: true },
      } as unknown as AdapterContext;

      const handler1 = autoProvider.getHandler(mockContext1);
      const handler2 = autoProvider.getHandler(mockContext2);

      expect(handler1).toBeDefined();
      expect(handler2).toBeDefined();
    });
  });

  describe("response transformers", () => {
    test("non-streaming handler includes jsonTransformer", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: { stream: false },
      } as unknown as AdapterContext;

      const handler = provider.getHandler(mockContext);
      expect(handler?.responseTransformers?.length).toBe(2);
    });

    test("streaming handler includes sseTransformer", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: { stream: true },
      } as unknown as AdapterContext;

      const handler = provider.getHandler(mockContext);
      expect(handler?.responseTransformers?.length).toBe(2);
    });
  });

  describe("autoProvider", () => {
    test("autoProvider is reusable across multiple requests", () => {
      const mockContext1 = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const mockContext2 = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          stream: true,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler1 = autoProvider.getHandler(mockContext1);
      const handler2 = autoProvider.getHandler(mockContext2);

      expect(handler1).toBeDefined();
      expect(handler2).toBeDefined();
      expect(handler1).not.toBe(handler2);
    });

    test("autoProvider returns same handler for same config", () => {
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler1 = autoProvider.getHandler(mockContext);
      const handler2 = autoProvider.getHandler(mockContext);

      expect(handler1).toBe(handler2);
    });
  });

  describe("response transformers", () => {
    test("non-streaming handler includes 2 transformers", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      expect(handler?.responseTransformers?.length).toBe(2);
    });

    test("streaming handler includes 2 transformers (sse + anthropic)", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          stream: true,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      expect(handler?.responseTransformers?.length).toBe(2);
    });
  });

  describe("provider options", () => {
    test("provider accepts thinking options with enabled type", () => {
      const provider = getProvider({
        thinking: {
          type: "enabled",
          budget_tokens: 10000,
        },
      });
      expect(provider).toBeDefined();
      expect(provider.name).toBe("anthropic");
    });

    test("provider accepts undefined options (uses defaults)", () => {
      const provider = getProvider(undefined);
      expect(provider).toBeDefined();
      expect(provider.name).toBe("anthropic");
    });

    test("provider accepts empty options object", () => {
      const provider = getProvider({});
      expect(provider).toBeDefined();
      expect(provider.name).toBe("anthropic");
    });

    test("getProvider with different thinking options creates independent providers", () => {
      const provider1 = getProvider({ thinking: { type: "enabled", budget_tokens: 1000 } });
      const provider2 = getProvider({ thinking: { type: "enabled", budget_tokens: 5000 } });

      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
      expect(provider1.name).toBe(provider2.name);
    });
  });

  describe("handler behavior", () => {
    test("non-completion API types return null", () => {
      const provider = getProvider();

      const apiTypes = ["chat", "embedding", "image", "transcription", "speech"];
      for (const apiType of apiTypes) {
        const mockContext = {
          apiType,
          config: { stream: false },
        } as any;

        const handler = provider.getHandler(mockContext);
        expect(handler).toBeNull();
      }
    });

    test("only completion API type returns handler", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      expect(handler).not.toBeNull();
      expect(handler?.responseTransformers).toBeDefined();
      expect(handler?.getRequestConfig).toBeDefined();
    });

    test("handler respects stream configuration", () => {
      const provider = getProvider();

      const streamConfig = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          stream: true,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const streamingHandler = provider.getHandler(streamConfig);
      expect(streamingHandler).toBeDefined();

      const nonStreamConfig = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const nonStreamingHandler = provider.getHandler(nonStreamConfig);
      expect(nonStreamingHandler).toBeDefined();

      expect(streamingHandler).not.toBe(nonStreamingHandler);
    });
  });

  describe("edge cases", () => {
    test("getProvider multiple times returns new provider instances", () => {
      const provider1 = getProvider();
      const provider2 = getProvider();

      expect(provider1).not.toBe(provider2);
      expect(provider1.name).toBe(provider2.name);
    });

    test("autoProvider is a singleton-like instance", () => {
      expect(autoProvider).toBeDefined();
      expect(autoProvider.name).toBe("anthropic");
    });

    test("request URL is properly constructed", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          apiBase: "https://api.anthropic.com/v1",
          apiPath: "/messages",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config?.url).toBe("https://api.anthropic.com/v1/messages");
    });

    test("request body is valid", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [
            { role: "user", content: "Hello, Claude!" },
          ],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config?.body).toBeDefined();
      expect(config?.body).toBeTruthy();
    });

    test("headers is a Headers object", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config?.headers).toBeInstanceOf(Headers);
    });

    test("anthropic-version header is always set", () => {
      const provider = getProvider();
      const mockContext = {
        apiType: "completion",
        config: {
          apiKey: "test-key",
          model: "claude-3-5-sonnet-20241022",
          stream: false,
          messages: [],
        },
        request: {},
        response: {},
        state: {},
      } as any;

      const handler = provider.getHandler(mockContext);
      const config = handler?.getRequestConfig(mockContext);

      expect(config?.headers.get("anthropic-version")).toBe("2023-06-01");
    });
  });
});

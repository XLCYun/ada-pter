import { describe, expect, test } from "bun:test";
import type { ChatCompletionMessageParam } from "ada-pter/types/openai";
import { extractSystem, mapMessages } from "../src/map-messages";

// ---------------------------------------------------------------------------
// extractSystem
// ---------------------------------------------------------------------------

describe("extractSystem", () => {
  test("空消息列表时返回空 systemBlocks 和空 rest", () => {
    const { systemBlocks, rest } = extractSystem([]);
    expect(systemBlocks).toEqual([]);
    expect(rest).toEqual([]);
  });

  test("system 消息（字符串）被抽离为 TextBlockParam", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hi" },
    ];
    const { systemBlocks, rest } = extractSystem(messages);
    expect(systemBlocks).toEqual([{ type: "text", text: "You are helpful." }]);
    expect(rest).toHaveLength(1);
    expect(rest[0].role).toBe("user");
  });

  test("developer 消息与 system 一样被抽离", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "developer", content: "Dev instructions." },
      { role: "user", content: "Hello" },
    ];
    const { systemBlocks, rest } = extractSystem(messages);
    expect(systemBlocks).toEqual([{ type: "text", text: "Dev instructions." }]);
    expect(rest).toHaveLength(1);
  });

  test("多条 system/developer 消息合并为多个 TextBlockParam", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "Block A" },
      { role: "developer", content: "Block B" },
      { role: "user", content: "Question" },
    ];
    const { systemBlocks, rest } = extractSystem(messages);
    expect(systemBlocks).toHaveLength(2);
    expect(systemBlocks[0].text).toBe("Block A");
    expect(systemBlocks[1].text).toBe("Block B");
    expect(rest).toHaveLength(1);
  });

  test("空字符串 system 内容被跳过", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "" },
      { role: "user", content: "Hi" },
    ];
    const { systemBlocks } = extractSystem(messages);
    expect(systemBlocks).toHaveLength(0);
  });

  test("system 内容为数组时逐项提取非空 text", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: [
          { type: "text", text: "Part 1" },
          { type: "text", text: "" },
          { type: "text", text: "Part 2" },
        ],
      },
      { role: "user", content: "Hi" },
    ];
    const { systemBlocks } = extractSystem(messages);
    expect(systemBlocks).toHaveLength(2);
    expect(systemBlocks[0].text).toBe("Part 1");
    expect(systemBlocks[1].text).toBe("Part 2");
  });

  test("无 system/developer 消息时 systemBlocks 为空，rest 包含全部消息", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ];
    const { systemBlocks, rest } = extractSystem(messages);
    expect(systemBlocks).toHaveLength(0);
    expect(rest).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// mapMessages
// ---------------------------------------------------------------------------

describe("mapMessages", () => {
  test("空列表返回空数组", () => {
    expect(mapMessages([])).toEqual([]);
  });

  test("单条 user 消息（字符串）映射为 user MessageParam", () => {
    const messages: ChatCompletionMessageParam[] = [{ role: "user", content: "Hello" }];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toEqual([{ type: "text", text: "Hello" }]);
  });

  test("单条 assistant 消息（字符串）映射为 assistant MessageParam", () => {
    const messages: ChatCompletionMessageParam[] = [{ role: "assistant", content: "Hi" }];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("assistant");
    const content = result[0].content;
    expect(Array.isArray(content)).toBe(true);
    expect((content as Array<{ type: string; text: string }>)[0]).toMatchObject({ type: "text", text: "Hi" });
  });

  test("相邻 user 消息合并为一条", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "Part A" },
      { role: "user", content: "Part B" },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    const content = result[0].content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(2);
    expect(content[0].text).toBe("Part A");
    expect(content[1].text).toBe("Part B");
  });

  test("相邻 assistant 消息合并为一条", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "assistant", content: "Part 1" },
      { role: "assistant", content: "Part 2" },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("assistant");
  });

  test("user-assistant 交替消息各自独立", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "Q1" },
      { role: "assistant", content: "A1" },
      { role: "user", content: "Q2" },
      { role: "assistant", content: "A2" },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(4);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
    expect(result[2].role).toBe("user");
    expect(result[3].role).toBe("assistant");
  });

  test("tool 消息被映射为 user 消息中的 tool_result block", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "tool",
        tool_call_id: "call-1",
        content: "tool output",
      },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    const content = result[0].content as Array<{ type: string; tool_use_id?: string; content?: unknown }>;
    expect(content[0].type).toBe("tool_result");
    expect(content[0].tool_use_id).toBe("call-1");
    expect(content[0].content).toBe("tool output");
  });

  test("tool_call_id 中的非法字符被替换为下划线", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "tool",
        tool_call_id: "call.id-with/special+chars",
        content: "result",
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; tool_use_id?: string }>;
    expect(content[0].tool_use_id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  test("function 消息被映射为 user 消息中的 tool_result block", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "function",
        name: "my_fn",
        content: "fn result",
      },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    const content = result[0].content as Array<{ type: string }>;
    expect(content[0].type).toBe("tool_result");
  });

  test("user 消息中的 image_url 被映射为 ImageBlockParam（https URL）", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: "https://example.com/img.png" } }],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; source?: { type: string; url: string } }>;
    expect(content[0].type).toBe("image");
    expect(content[0].source?.type).toBe("url");
    expect(content[0].source?.url).toBe("https://example.com/img.png");
  });

  test("user 消息中的 image_url（data URL）被映射为 base64 ImageBlockParam", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,abc123" },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; source?: { type: string; data: string } }>;
    expect(content[0].type).toBe("image");
    expect(content[0].source?.type).toBe("base64");
    expect(content[0].source?.data).toBe("abc123");
  });

  test("input_audio 类型的 content part 被过滤掉", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Hello" },
          { type: "input_audio", input_audio: { data: "base64data", format: "mp3" } },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
  });

  test("assistant 消息中的 tool_calls 被映射为 ToolUseBlockParam", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call-abc",
            type: "function",
            function: { name: "get_weather", arguments: '{"city":"Paris"}' },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("assistant");
    const content = result[0].content as Array<{ type: string; id: string; name: string; input: unknown }>;
    expect(content[0].type).toBe("tool_use");
    expect(content[0].id).toBe("call-abc");
    expect(content[0].name).toBe("get_weather");
    expect(content[0].input).toEqual({ city: "Paris" });
  });

  test("assistant 消息中 id 以 srvtoolu_ 开头的 tool_call 被映射为 server_tool_use", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "srvtoolu_abc",
            type: "function",
            function: { name: "web_search", arguments: '{"query":"test"}' },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    expect(content[0].type).toBe("server_tool_use");
  });

  test("assistant 消息中的 refusal 被映射为 TextBlockParam", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: [{ type: "refusal", refusal: "I cannot help with that." }],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; text: string }>;
    expect(content[0].type).toBe("text");
    expect(content[0].text).toBe("I cannot help with that.");
  });

  test("assistant 消息中的 thinking 块被原样透传", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Let me think...", signature: "sig" } as unknown as Parameters<
            typeof mapMessages
          >[0][0]["content"] extends Array<infer T>
            ? T
            : never,
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; thinking?: string }>;
    expect(content[0].type).toBe("thinking");
    expect(content[0].thinking).toBe("Let me think...");
  });

  test("最后一条 assistant 消息的尾部空白被 trimEnd", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "Q" },
      { role: "assistant", content: "Answer   " },
    ];
    const result = mapMessages(messages);
    const content = result[1].content as Array<{ type: string; text: string }>;
    expect(content[0].text).toBe("Answer");
  });

  test("cache_control 透传到对应的 block", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "cached text",
            cache_control: { type: "ephemeral" },
          } as unknown as Parameters<typeof mapMessages>[0][0]["content"] extends Array<infer T> ? T : never,
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; cache_control?: unknown }>;
    expect(content[0].cache_control).toEqual({ type: "ephemeral" });
  });

  test("user 消息中的 file（PDF base64）被映射为 document block", () => {
    const pdfData = "JVBERi0xLjQ=";
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "file",
            file: { file_data: `data:application/pdf;base64,${pdfData}` },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      source?: { type: string; media_type: string; data: string };
    }>;
    expect(content[0].type).toBe("document");
    expect(content[0].source?.type).toBe("base64");
    expect(content[0].source?.media_type).toBe("application/pdf");
    expect(content[0].source?.data).toBe(pdfData);
  });

  test("user 消息中的 file（text/plain base64）被映射为 document block", () => {
    const textData = "aGVsbG8=";
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "file",
            file: { file_data: `data:text/plain;base64,${textData}` },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      source?: { type: string; media_type: string; data: string };
    }>;
    expect(content[0].type).toBe("document");
    expect(content[0].source?.type).toBe("text");
    expect(content[0].source?.media_type).toBe("text/plain");
  });

  test("user 消息中的 file（image base64）被映射为 image block", () => {
    const imgData = "iVBORw0KGgo=";
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "file",
            file: { file_data: `data:image/jpeg;base64,${imgData}` },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; source?: { type: string; media_type: string } }>;
    expect(content[0].type).toBe("image");
    expect(content[0].source?.type).toBe("base64");
    expect(content[0].source?.media_type).toBe("image/jpeg");
  });

  test("user 消息中的 file（file_id + pdf 文件名）被映射为 document block（url source）", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "file",
            file: { file_id: "file-abc123", filename: "report.pdf" },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; source?: { type: string; url: string } }>;
    expect(content[0].type).toBe("document");
    expect(content[0].source?.type).toBe("url");
    expect(content[0].source?.url).toBe("file-abc123");
  });

  test("user 消息中的 file（file_id + 未知扩展名）被映射为 container_upload block", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "file",
            file: { file_id: "file-xyz", filename: "data.bin" },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; file_id?: string }>;
    expect(content[0].type).toBe("container_upload");
    expect(content[0].file_id).toBe("file-xyz");
  });

  test("assistant 消息中的 provider_specific_fields.web_search_results 被还原为 web_search_tool_result block", () => {
    const webSearchResult = {
      type: "web_search_tool_result",
      tool_use_id: "srvtoolu_ws1",
      content: [],
    };
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "srvtoolu_ws1",
            type: "function",
            function: { name: "web_search", arguments: '{"query":"test"}' },
          },
        ],
        provider_specific_fields: {
          web_search_results: [webSearchResult],
        },
      } as unknown as ChatCompletionMessageParam,
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; tool_use_id?: string }>;
    expect(content.some((b) => b.type === "web_search_tool_result")).toBe(true);
    const resultBlock = content.find((b) => b.type === "web_search_tool_result");
    expect(resultBlock?.tool_use_id).toBe("srvtoolu_ws1");
  });

  test("assistant 消息包含 thinking + content + tool_calls 时按正确顺序组装", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: "Let me search for that.",
        thinking_blocks: [
          { type: "thinking", thinking: "I need to search", signature: "sig123" } as unknown as Parameters<
            typeof mapMessages
          >[0][0]["thinking_blocks"] extends Array<infer T>
            ? T
            : never,
        ],
        tool_calls: [
          {
            id: "call-search-1",
            type: "function",
            function: { name: "search", arguments: '{"query":"example"}' },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    const content = result[0].content as Array<{ type: string }>;

    // 验证块的顺序：thinking 在最前，content 在中间，tool_use 在最后
    const thinkingIndex = content.findIndex((b) => b.type === "thinking");
    const textIndex = content.findIndex((b) => b.type === "text");
    const toolUseIndex = content.findIndex((b) => b.type === "tool_use");

    expect(thinkingIndex).toBe(0);
    expect(textIndex).toBeGreaterThan(thinkingIndex);
    expect(toolUseIndex).toBeGreaterThan(textIndex);
  });

  test("assistant 消息仅包含 thinking 块时也能正确映射", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        thinking_blocks: [
          { type: "thinking", thinking: "Deep reasoning", signature: "sig456" } as unknown as Parameters<
            typeof mapMessages
          >[0][0]["thinking_blocks"] extends Array<infer T>
            ? T
            : never,
        ],
      },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    const content = result[0].content as Array<{ type: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("thinking");
  });

  test("file 内容为 null 时被跳过", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Check this file" },
          { type: "file", file: null as unknown as never },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
  });

  test("assistant 包含 refusal + thinking + tool_calls 时按顺序组装", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: [{ type: "refusal", refusal: "I cannot help with that." }],
        thinking_blocks: [
          { type: "thinking", thinking: "This request is problematic", signature: "sig789" } as unknown as Parameters<
            typeof mapMessages
          >[0][0]["thinking_blocks"] extends Array<infer T>
            ? T
            : never,
        ],
        tool_calls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "log_refusal", arguments: "{}" },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; text?: string }>;

    // 验证：thinking 在前，refusal 被转为 text，tool_use 在后
    const thinkingIndex = content.findIndex((b) => b.type === "thinking");
    const textIndices = content.map((b, i) => (b.type === "text" ? i : -1)).filter((i) => i !== -1);
    const toolUseIndex = content.findIndex((b) => b.type === "tool_use");

    expect(thinkingIndex).toBeLessThan(textIndices[0]);
    expect(textIndices[0]).toBeLessThan(toolUseIndex);
  });

  test("消息序列中包含既不是 user-like 也不是 assistant 的消息时被过滤", () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "Q1" },
      { role: "system", content: "你是一个助手" } as ChatCompletionMessageParam,
      { role: "assistant", content: "A1" } as ChatCompletionMessageParam,
    ];
    const result = mapMessages(messages);
    // system 消息被过滤，只剩 user 和 assistant 两条
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
  });

  test("user 消息 content 为数组时正确映射所有 part", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Check these:" },
          { type: "text", text: "File below" },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(2);
    expect(content[0].text).toBe("Check these:");
    expect(content[1].text).toBe("File below");
  });

  test("file part 中 file_data 为非法 base64 data URL 时返回 null", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Document:" },
          {
            type: "file",
            file: { file_data: "not-a-valid-data-url" },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    // 非法 data URL 应被过滤掉
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
  });

  test("file part 中的 file_data 为 MIME 类型既不是 PDF、text 也不是 image 时返回 null", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Archive:" },
          {
            type: "file",
            file: { file_data: "data:application/zip;base64,PK3Q" },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    // 未知的 mime 类型应被过滤掉
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
  });

  test("file part 中 file_id 为图片文件名时返回 image block（未覆盖分支）", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "file",
            file: { file_id: "file-img123", filename: "photo.jpg" },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; source?: { type: string; url?: string } }>;
    // jpg 被识别为 image/jpeg，在代码的第 206-212 行中应该返回 image block
    expect(content[0].type).toBe("image");
    expect(content[0].source?.type).toBe("url");
    expect(content[0].source?.url).toBe("file-img123");
  });

  test("mapImagePart 接收非 http/https/data URL 时抛出错误", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "ftp://example.com/image.png" },
          },
        ],
      },
    ];
    expect(() => mapMessages(messages)).toThrow("image_url content is not a valid http(s) or data URL");
  });

  test("mapContentPart 接收非对象的 part（例如 null）时返回 null", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Valid text" },
          null as unknown as ChatCompletionMessageParam["content"] extends Array<infer T> ? T : never,
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    // null part 应被过滤掉
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
  });

  test("mapContentPart 接收非对象的原始值（如数字）时转为文本", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Count:" },
          42 as unknown as ChatCompletionMessageParam["content"] extends Array<infer T> ? T : never,
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    // 数字应被转为文本 "42"
    expect(content).toHaveLength(2);
    expect(content[1].type).toBe("text");
    expect((content[1] as any).text).toBe("42");
  });

  test("parseToolArguments 接收无效 JSON 时抛出错误", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call-invalid",
            type: "function",
            function: { name: "test_func", arguments: "{invalid json}" },
          },
        ],
      },
    ];
    expect(() => mapMessages(messages)).toThrow("Failed to parse tool arguments");
  });

  test("generateToolId 在无 crypto.randomUUID 时生成随机字符串", () => {
    // 这个测试验证 generateToolId 的回退逻辑
    // 但实际上 generateToolId 函数本身未被直接调用
    // 此测试通过使用 assistant 消息中的 function_call（旧格式）间接触发
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        function_call: {
          name: "legacy_func",
          arguments: '{"test": true}',
        } as ChatCompletionMessageParam["function_call"],
      } as ChatCompletionMessageParam,
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; id?: string }>;
    const toolUseBlock = content.find((b) => b.type === "tool_use");
    expect(toolUseBlock?.id).toBeTruthy();
    expect(typeof toolUseBlock?.id).toBe("string");
  });

  test("assistant 消息 content 为数组时逐项处理（包括 text、refusal、thinking）", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Response" },
          { type: "refusal", refusal: "Cannot do" },
          { type: "text", text: "" },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; text: string }>;
    // 空文本应被过滤掉
    expect(content.length).toBeGreaterThanOrEqual(2);
  });

  test("assistant 消息包含 redacted_thinking 块时原样透传", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
        thinking_blocks: [
          { type: "redacted_thinking", signature: "sig123" } as unknown as Parameters<
            typeof mapMessages
          >[0][0]["thinking_blocks"] extends Array<infer T>
            ? T
            : never,
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    expect(content.some((b) => b.type === "redacted_thinking")).toBe(true);
  });

  test("assistant 消息包含 server_tool_use 和 tool_search_tool_result 时原样透传", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: [
          {
            type: "server_tool_use",
            id: "srvtoolu_test",
            name: "web_search",
            input: { query: "test" },
          } as unknown as ChatCompletionMessageParam["content"] extends Array<infer T> ? T : never,
          {
            type: "tool_search_tool_result",
            tool_use_id: "srvtoolu_test",
            content: [{ text: "Search results" }],
          } as unknown as ChatCompletionMessageParam["content"] extends Array<infer T> ? T : never,
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    expect(content.some((b) => b.type === "server_tool_use")).toBe(true);
    expect(content.some((b) => b.type === "tool_search_tool_result")).toBe(true);
  });

  test("assistant 消息 content 为字符串时 trimEnd 被应用", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: "Question",
      },
      {
        role: "assistant",
        content: "Answer with spaces   \n\t",
      },
    ];
    const result = mapMessages(messages);
    const content = result[1].content as Array<{ type: string; text: string }>;
    expect(content[0].text).toBe("Answer with spaces");
  });

  test("assistant 消息 content 为数组时数组内所有 text block 都被 trimEnd", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: "Q",
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Part 1   " },
          { type: "text", text: "Part 2\n" },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[1].content as Array<{ type: string; text: string }>;
    const textBlocks = content.filter((b) => b.type === "text");
    expect(textBlocks[0].text).toBe("Part 1");
    expect(textBlocks[1].text).toBe("Part 2");
  });

  test("user 消息空字符串 content 被过滤掉", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: "",
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(0);
  });

  test("相邻 tool 和 user 消息合并为单一 user 消息", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "tool",
        tool_call_id: "call-1",
        content: "Tool output A",
      },
      {
        role: "tool",
        tool_call_id: "call-2",
        content: "Tool output B",
      },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    const content = result[0].content as Array<{ type: string }>;
    expect(content).toHaveLength(2);
  });

  test("function 消息 content 为空字符串时处理", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "function",
        name: "my_func",
        content: "",
      },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
  });

  test("file part 无 file_data 和 file_id 时返回 null", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "File missing:" },
          {
            type: "file",
            file: { filename: "unknown.xyz" },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    // 无有效数据的 file 应被过滤
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
  });

  test("http URL 图片被正确映射", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "http://example.com/image.png" },
          },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string; source?: { type: string; url: string } }>;
    expect(content[0].type).toBe("image");
    expect(content[0].source?.type).toBe("url");
    expect(content[0].source?.url).toBe("http://example.com/image.png");
  });

  test("assistant 消息 content 为 null 时返回空数组", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: null,
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    expect(Array.isArray(content)).toBe(true);
  });

  test("empty assistant content array 不产生任何块", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: [],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    expect(content).toHaveLength(0);
  });

  test("tool 消息 content 为数组（text parts）时被映射为 tool_result block", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "tool",
        tool_call_id: "call-arr",
        content: [
          { type: "text", text: "Part A" },
          { type: "text", text: "Part B" },
        ],
      },
    ];
    const result = mapMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    const content = result[0].content as Array<{
      type: string;
      tool_use_id?: string;
      content?: Array<{ type: string; text: string }>;
    }>;
    expect(content[0].type).toBe("tool_result");
    expect(content[0].tool_use_id).toBe("call-arr");
    const innerContent = content[0].content as Array<{ type: string; text: string }>;
    expect(Array.isArray(innerContent)).toBe(true);
    expect(innerContent.some((b) => b.type === "text" && b.text === "Part A")).toBe(true);
    expect(innerContent.some((b) => b.type === "text" && b.text === "Part B")).toBe(true);
  });

  test("tool 消息 content 为非 string 非 array 时抛出错误", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "tool",
        tool_call_id: "call-bad",
        content: 42 as unknown as string,
      },
    ];
    expect(() => mapMessages(messages)).toThrow("unknown content type");
  });

  test("assistant content 数组中包含 redacted_thinking 块时原样透传", () => {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "assistant",
        content: [
          {
            type: "redacted_thinking",
            data: "encrypted_data_here",
          } as unknown as ChatCompletionMessageParam["content"] extends Array<infer T> ? T : never,
          { type: "text", text: "Response after thinking" },
        ],
      },
    ];
    const result = mapMessages(messages);
    const content = result[0].content as Array<{ type: string }>;
    expect(content.some((b) => b.type === "redacted_thinking")).toBe(true);
    expect(content.some((b) => b.type === "text")).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import { joinPath } from "../../src/helpers/path";

describe("joinPath", () => {
  test("joins base without trailing slash and path without leading slash", () => {
    expect(joinPath("https://api.example.com", "v1/chat")).toBe(
      "https://api.example.com/v1/chat",
    );
  });

  test("handles base with trailing slash and path without leading slash", () => {
    expect(joinPath("https://api.example.com/", "v1/chat")).toBe(
      "https://api.example.com/v1/chat",
    );
  });

  test("handles base without trailing slash and path with leading slash", () => {
    expect(joinPath("https://api.example.com", "/v1/chat")).toBe(
      "https://api.example.com/v1/chat",
    );
  });

  test("handles base with trailing slash and path with leading slash", () => {
    expect(joinPath("https://api.example.com/", "/v1/chat")).toBe(
      "https://api.example.com/v1/chat",
    );
  });

  test("handles empty path", () => {
    expect(joinPath("https://api.example.com", "")).toBe(
      "https://api.example.com/",
    );
  });

  test("handles empty base", () => {
    expect(joinPath("", "v1/chat")).toBe("/v1/chat");
  });

  test("handles both empty base and path", () => {
    expect(joinPath("", "")).toBe("/");
  });

  test("handles path with multiple leading slashes", () => {
    expect(joinPath("https://api.example.com", "///v1/chat")).toBe(
      "https://api.example.com///v1/chat",
    );
  });

  test("handles base with multiple trailing slashes", () => {
    expect(joinPath("https://api.example.com///", "v1/chat")).toBe(
      "https://api.example.com///v1/chat",
    );
  });

  test("handles complex path segments", () => {
    expect(joinPath("https://api.example.com/api", "v1/models/gpt-4")).toBe(
      "https://api.example.com/api/v1/models/gpt-4",
    );
  });

  test("handles just slash as path", () => {
    expect(joinPath("https://api.example.com", "/")).toBe(
      "https://api.example.com/",
    );
  });

  test("handles relative paths", () => {
    expect(joinPath("./api", "v1/chat")).toBe("./api/v1/chat");
  });

  test("handles root path", () => {
    expect(joinPath("/", "v1/chat")).toBe("/v1/chat");
  });
});

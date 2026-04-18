export * from "./extend";
export * from "./params";
export * from "./response";
export * from "./shared";

import type { ChatCompletionAssistantMessageParam } from "./params";
import type { ChatCompletionMessage } from "./response";

// Assistant message like: assistant message from param or assistant message from response
export type AssistantMessageLike = ChatCompletionAssistantMessageParam | ChatCompletionMessage;

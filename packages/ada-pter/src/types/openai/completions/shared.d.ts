/** Tool_calls field type definition, used in both parameters and responses */
export type ChatCompletionMessageToolCall = ChatCompletionMessageFunctionToolCall | ChatCompletionMessageCustomToolCall;

export interface ChatCompletionMessageFunctionToolCall {
  id: string;
  function: ChatCompletionMessageFunctionToolCallFunction;
  type: "function";
}

export interface ChatCompletionMessageCustomToolCall {
  id: string;
  custom: ChatCompletionMessageCustomToolCallCustom;
  type: "custom";
}

export interface ChatCompletionMessageFunctionToolCallFunction {
  arguments: string;
  name: string;
}

export interface ChatCompletionMessageCustomToolCallCustom {
  input: string;
  name: string;
}

/** function_call field type definition, used in both parameters and responses */
export interface ChatCompletionMessageFunctionCall {
  arguments: string;
  name: string;
}

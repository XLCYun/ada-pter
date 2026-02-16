import type { ResponseTransformer } from "../types";
import { jsonTransformer } from "./json";
import { sseTransformer } from "./sse";

export const autoResponseTransformers: ResponseTransformer[] = [
  jsonTransformer,
  sseTransformer,
];

import type { AdapterConfig } from "../config";
import type {
  InputItemListParams,
  Response,
  ResponseCancelResponse,
  ResponseCompactedResponse,
  ResponseCompactParams,
  ResponseCreateParams,
  ResponseDeleteResponse,
  ResponseItemsPage,
  ResponseStreamEvent,
} from "../openai/responses";

export type ResponseCreateRequest = ResponseCreateParams & AdapterConfig;
export type ResponseCreateResponse = Response;
export type ResponseCreateStreamChunk = ResponseStreamEvent;

export interface ResponseCancelRequest extends AdapterConfig {
  response_id: string;
}
export type ResponseCancelResult = ResponseCancelResponse;

export interface ResponseDeleteRequest extends AdapterConfig {
  response_id: string;
}
export type ResponseDeleteResult = ResponseDeleteResponse;

export type ResponseCompactRequest = ResponseCompactParams & AdapterConfig;
export type ResponseCompactResult = ResponseCompactedResponse;

export interface ResponseRetrieveRequest extends AdapterConfig {
  response_id: string;
}
export type ResponseRetrieveResponse = Response;
export type ResponseRetrieveStreamChunk = ResponseStreamEvent;

export interface ResponseInputItemsListRequest
  extends InputItemListParams,
    AdapterConfig {
  response_id: string;
}
export type ResponseInputItemsListResponse = ResponseItemsPage;

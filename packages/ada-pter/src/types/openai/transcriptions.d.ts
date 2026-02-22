// Standalone type definitions for audio.transcriptions.create

export interface TranscriptionsAPI {
  create(
    body: TranscriptionCreateParamsNonStreaming<"json" | undefined>,
    options?: RequestOptions,
  ): APIPromise<Transcription>;
  create(
    body: TranscriptionCreateParamsNonStreaming<"verbose_json">,
    options?: RequestOptions,
  ): APIPromise<TranscriptionVerbose>;
  create(
    body: TranscriptionCreateParamsNonStreaming<"srt" | "vtt" | "text">,
    options?: RequestOptions,
  ): APIPromise<string>;
  create(
    body: TranscriptionCreateParamsNonStreaming,
    options?: RequestOptions,
  ): APIPromise<Transcription>;
  create(
    body: TranscriptionCreateParamsStreaming,
    options?: RequestOptions,
  ): APIPromise<Stream<TranscriptionStreamEvent>>;
  create(
    body: TranscriptionCreateParamsStreaming,
    options?: RequestOptions,
  ): APIPromise<
    TranscriptionCreateResponse | string | Stream<TranscriptionStreamEvent>
  >;
  create(
    body: TranscriptionCreateParams,
    options?: RequestOptions,
  ): APIPromise<
    TranscriptionCreateResponse | string | Stream<TranscriptionStreamEvent>
  >;
}

export type APIPromise<T> = Promise<T>;

export interface Stream<T> extends AsyncIterable<T> {}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

export type Uploadable = Blob | File | Buffer | string;

export type AudioModel = string;

export type AudioResponseFormat =
  | "json"
  | "text"
  | "srt"
  | "verbose_json"
  | "vtt"
  | "diarized_json";

export interface Transcription {
  text: string;
  logprobs?: Array<TranscriptionLogprob>;
  usage?: TranscriptionTokens | TranscriptionDuration;
}

export interface TranscriptionLogprob {
  token?: string;
  bytes?: Array<number>;
  logprob?: number;
}

export interface TranscriptionTokens {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  type: "tokens";
  input_token_details?: TranscriptionInputTokenDetails;
}

export interface TranscriptionInputTokenDetails {
  audio_tokens?: number;
  text_tokens?: number;
}

export interface TranscriptionDuration {
  seconds: number;
  type: "duration";
}

export interface TranscriptionDiarized {
  duration: number;
  segments: Array<TranscriptionDiarizedSegment>;
  task: "transcribe";
  text: string;
  usage?: TranscriptionDiarizedTokens | TranscriptionDiarizedDuration;
}

export interface TranscriptionDiarizedTokens {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  type: "tokens";
  input_token_details?: TranscriptionDiarizedInputTokenDetails;
}

export interface TranscriptionDiarizedInputTokenDetails {
  audio_tokens?: number;
  text_tokens?: number;
}

export interface TranscriptionDiarizedDuration {
  seconds: number;
  type: "duration";
}

export interface TranscriptionDiarizedSegment {
  id: string;
  end: number;
  speaker: string;
  start: number;
  text: string;
  type: "transcript.text.segment";
}

export type TranscriptionInclude = "logprobs";

export interface TranscriptionSegment {
  id: number;
  avg_logprob: number;
  compression_ratio: number;
  end: number;
  no_speech_prob: number;
  seek: number;
  start: number;
  temperature: number;
  text: string;
  tokens: Array<number>;
}

export type TranscriptionStreamEvent =
  | TranscriptionTextSegmentEvent
  | TranscriptionTextDeltaEvent
  | TranscriptionTextDoneEvent;

export interface TranscriptionTextDeltaEvent {
  delta: string;
  type: "transcript.text.delta";
  logprobs?: Array<TranscriptionTextDeltaLogprob>;
  segment_id?: string;
}

export interface TranscriptionTextDeltaLogprob {
  token?: string;
  bytes?: Array<number>;
  logprob?: number;
}

export interface TranscriptionTextDoneEvent {
  text: string;
  type: "transcript.text.done";
  logprobs?: Array<TranscriptionTextDoneLogprob>;
  usage?: TranscriptionTextDoneUsage;
}

export interface TranscriptionTextDoneLogprob {
  token?: string;
  bytes?: Array<number>;
  logprob?: number;
}

export interface TranscriptionTextDoneUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  type: "tokens";
  input_token_details?: TranscriptionTextDoneInputTokenDetails;
}

export interface TranscriptionTextDoneInputTokenDetails {
  audio_tokens?: number;
  text_tokens?: number;
}

export interface TranscriptionTextSegmentEvent {
  id: string;
  end: number;
  speaker: string;
  start: number;
  text: string;
  type: "transcript.text.segment";
}

export interface TranscriptionVerbose {
  duration: number;
  language: string;
  text: string;
  segments?: Array<TranscriptionSegment>;
  usage?: TranscriptionVerboseUsage;
  words?: Array<TranscriptionWord>;
}

export interface TranscriptionVerboseUsage {
  seconds: number;
  type: "duration";
}

export interface TranscriptionWord {
  end: number;
  start: number;
  word: string;
}

export type TranscriptionCreateResponse =
  | Transcription
  | TranscriptionDiarized
  | TranscriptionVerbose;

export type TranscriptionCreateParams<
  ResponseFormat extends AudioResponseFormat | undefined =
    | AudioResponseFormat
    | undefined,
> =
  | TranscriptionCreateParamsNonStreaming<ResponseFormat>
  | TranscriptionCreateParamsStreaming;

export interface TranscriptionCreateParamsBase<
  ResponseFormat extends AudioResponseFormat | undefined =
    | AudioResponseFormat
    | undefined,
> {
  file: Uploadable;
  model: (string & {}) | AudioModel;
  chunking_strategy?: "auto" | VadConfig | null;
  include?: Array<TranscriptionInclude>;
  known_speaker_names?: Array<string>;
  known_speaker_references?: Array<string>;
  language?: string;
  prompt?: string;
  response_format?: ResponseFormat;
  stream?: boolean | null;
  temperature?: number;
  timestamp_granularities?: Array<"word" | "segment">;
}

export interface VadConfig {
  type: "server_vad";
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  threshold?: number;
}

export interface TranscriptionCreateParamsNonStreaming<
  ResponseFormat extends AudioResponseFormat | undefined =
    | AudioResponseFormat
    | undefined,
> extends TranscriptionCreateParamsBase<ResponseFormat> {
  stream?: false | null;
}

export interface TranscriptionCreateParamsStreaming
  extends TranscriptionCreateParamsBase {
  stream: true;
}

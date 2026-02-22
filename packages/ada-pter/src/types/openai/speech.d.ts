// Standalone type definitions for audio.speech.create

export interface SpeechAPI {
  create(
    body: SpeechCreateParams,
    options?: RequestOptions,
  ): APIPromise<Response>;
}

export type APIPromise<T> = Promise<T>;

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

export type SpeechModel = string;

export interface SpeechCreateParams {
  /** The text to generate audio for. The maximum length is 4096 characters. */
  input: string;

  /**
   * One of the available TTS models: `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`, or
   * `gpt-4o-mini-tts-2025-12-15`.
   */
  model: (string & {}) | SpeechModel;

  /**
   * The voice to use when generating the audio.
   */
  voice:
    | (string & {})
    | "alloy"
    | "ash"
    | "ballad"
    | "coral"
    | "echo"
    | "sage"
    | "shimmer"
    | "verse"
    | "marin"
    | "cedar";

  /** Control the voice with additional instructions. Not supported for `tts-1` or `tts-1-hd`. */
  instructions?: string;

  /** Output format. Supported: `mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`. */
  response_format?:
    | "mp3"
    | "opus"
    | "aac"
    | "flac"
    | "wav"
    | "pcm"
    | (string & {});

  /** Speed of the generated audio (0.25–4.0). Default is 1.0. */
  speed?: number;

  /** Format for streaming audio. Supported: `sse`, `audio`. */
  stream_format?: "sse" | "audio";
}

export interface SpeechAudioDeltaEvent {
  type: "speech.audio.delta";
  /** Base64-encoded audio chunk. */
  audio: string;
}

export interface SpeechAudioDoneEvent {
  type: "speech.audio.done";
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

export type SpeechStreamEvent = SpeechAudioDeltaEvent | SpeechAudioDoneEvent;

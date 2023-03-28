import axios from "axios";
import { from } from "rxjs";
import { switchMap } from "rxjs/operators";
import { elevenLabsConfig, retryConfig } from "../config.mjs";
import { errorHandlerWithDelay, sanitizeString, streamToFile } from "./lib.mjs";

const DEFAULT_HEADERS = {
  Accept: "audio/mpeg",
  "xi-api-key": "",
  "Content-Type": "application/json",
};

/**
 * Create a client for ElevenLabs API
 * @param {string} apiKey The API for the ElevenLabs API
 * @param {string} baseUrl The base URL for the ElevenLabs API
 */
export function createElevenLabsClient(
  apiKey = "",
  baseUrl = elevenLabsConfig.baseUrl
) {
  const headers = {
    ...DEFAULT_HEADERS,
    "xi-api-key": apiKey,
  };

  /**
   * Send text to ElevenLabs API, the text will be converted to speech and returned as a stream which is saved to a mp3 file
   * @param {string} text The text to pass to the ElevenLabs API, this text will first be sanatised of any special characters
   * @param {string} filePath The path to save the audio to (this should end with the required extension, e.g. .mp3)
   * @param {string=} voice The voice to use, defaults to 'Elli'
   * @param {object=} voice_settings The voice settings to use, defaults to `{ stability: 0.2, similarity_boost: 0.5 }`
   * @returns
   */
  function say(
    text,
    filePath,
    voice = elevenLabsConfig.voiceId,
    voice_settings = {}
  ) {
    return from(
      axios(`${baseUrl}/text-to-speech/${voice}/stream`, {
        method: "post",
        data: {
          text: sanitizeString(text),
          voice_settings: {
            ...elevenLabsConfig.voice_settings,
            ...voice_settings,
          },
        },
        headers,
        responseType: "stream",
      })
    ).pipe(
      switchMap((stream) => streamToFile(stream, filePath)),
      errorHandlerWithDelay(retryConfig)
    );
  }

  return {
    say,
  };
}

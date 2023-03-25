import axios from 'axios';
import { createWriteStream } from 'node:fs';
import { from, of } from 'rxjs';
import { concatMap, map, switchMap } from 'rxjs/operators';
import { elevenLabsConfig, retryConfig } from '../config.mjs';
import { errorHandlerWithDelay, sanitizeString } from './lib.mjs';

/**
 * Create a client for ElevenLabs API
 * @param {string} apiKey The API for the ElevenLabs API
 * @param {string} baseUrl The base URL for the ElevenLabs API
 */
export function createElevenLabsClient(
  apiKey = '',
  baseUrl = elevenLabsConfig.baseUrl
) {
  const configHeaders = {
    Accept: 'audio/mpeg',
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
  };

  /**
   * Takes a Axios request stream and saves it to a file
   * @param {import('axios').AxiosResponse} stream The Axios response stream
   * @param {string} filePath The filePath to save the stream to
   * @returns
   */
  function streamToFile(stream, filePath) {
    const out = createWriteStream(filePath);
    return of(stream.data).pipe(
      concatMap((data) => {
        return new Promise((resolve, reject) => {
          data.pipe(out);
          let error = null;
          out.on('error', (err) => {
            error = err;
            out.close();
          });
          out.on('close', () => (error ? reject(error) : resolve(filePath)));
        });
      })
    );
  }

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
        method: 'post',
        data: {
          text: sanitizeString(text),
          voice_settings: {
            ...elevenLabsConfig.voice_settings,
            ...voice_settings,
          },
        },
        headers: configHeaders,
        responseType: 'stream',
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

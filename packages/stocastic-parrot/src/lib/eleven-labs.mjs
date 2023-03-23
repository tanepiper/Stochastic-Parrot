import axios from 'axios';
import { createWriteStream } from 'node:fs';
import { from, of } from 'rxjs';
import { concatMap, map, switchMap } from 'rxjs/operators';
import { elevenLabsConfig, retryConfig } from '../config.mjs';
import { errorHandlerWithDelay, sanitize } from './lib.mjs';

/**
 * Create a client for ElevenLabs API
 * @param {string} apiKey
 * @returns
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
   * @param {*} stream
   * @param {*} filename
   * @returns
   */
  function streamToFile(stream, filename) {
    const out = createWriteStream(filename);
    return of(stream.data).pipe(
      concatMap((data) => {
        return new Promise((resolve, reject) => {
          data.pipe(out);
          let error = null;
          out.on('error', (err) => {
            error = err;
            writer.close();
            reject(err);
          });
          out.on('close', () => {
            if (!error) {
              resolve(true);
            }
          });
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
    voice_settings = { ...elevenLabsConfig.voice_settings, ...voice_settings };
    text = sanitize(text);

    const url = `${baseUrl}/text-to-speech/${voice}/stream`;
    return from(
      axios(url, {
        method: 'post',
        data: { text, voice_settings },
        headers: configHeaders,
        responseType: 'stream',
      })
    ).pipe(
      errorHandlerWithDelay(retryConfig),
      switchMap((stream) => streamToFile(stream, filePath)),
      map(() => filePath)
    );
  }

  return {
    say,
  };
}

import axios from 'axios';
import { from, of } from 'rxjs';
import { catchError, map, retry, concatMap, switchMap } from 'rxjs/operators';
import { createWriteStream } from 'node:fs';
import { sanitize } from './lib.mjs';
import { retryConfig, elevenLabsConfig } from '../config.mjs';

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
  function say(text, filePath, voice = elevenLabsConfig.voiceId, voice_settings = {}) {
    voice_settings = { ...elevenLabsConfig.voice_settings, ...voice_settings };
    text = sanitize(text);
    let retries = 0;

    const url = `${baseUrl}/text-to-speech/${voice}/stream`;
    return from(
      axios(url, {
        method: 'post',
        data: { text, voice_settings },
        headers: configHeaders,
        responseType: 'stream',
      })
    ).pipe(
      catchError((error) => {
        console.error(`${error.response.status}: ${error.response.statusText}`);
        if (error.response.status === 401) {
          console.error('Unable to process request, please check your API key');
          process.exit(1);
        }

        if (retries < config.retry.count) {
          retries++;
          console.log(`Retrying... (${retries}/${config.retry.count})`);
        } else {
          console.error(
            `Unable to process request after ${retries + 1} retries`
          );
        }
        return throwError(() => error);
      }),
      retry(retryConfig),
      switchMap((stream) => streamToFile(stream, filePath)),
      map(() => filePath)
    );
  }

  return {
    say,
  };
}

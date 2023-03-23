import axios from 'axios';
import { from, of } from 'rxjs';
import { catchError, map, retry, concatMap, switchMap } from 'rxjs/operators';
import { createWriteStream } from 'node:fs';
import { sanitize } from './lib.mjs';
import config from '../config.mjs';

const DEFAULT_VOICE_SETTINGS = {
  stability: 0.75,
  similarity_boost: 0.75,
};

/**
 * Create a client for ElevenLabs API
 * @param {string} apiKey
 * @returns
 */
export function createElevenLabsClient(
  apiKey = '',
  baseUrl = 'https://api.elevenlabs.io/v1'
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
   * @param {string} text
   * @param {string} voice
   * @param {string} filePath
   * @param {object} voice_settings
   * @returns
   */
  function say(text, voice, filePath, voice_settings = {}) {
    voice_settings = { ...DEFAULT_VOICE_SETTINGS, ...voice_settings };
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
      retry(config.retry),
      switchMap((stream) => streamToFile(stream, filePath)),
      map(() => filePath)
    );
  }

  return {
    say,
  };
}

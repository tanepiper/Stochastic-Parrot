import axios from 'axios';
import { from, of } from 'rxjs';
import { catchError, map, retry, concatMap, switchMap } from 'rxjs/operators';
import { createWriteStream } from 'node:fs';
import { sanitize } from './lib.mjs';

/**
 * Create a client for ElevenLabs API
 * @param {string} apiKey
 * @returns
 */
export function createElevenLabsClient(apiKey = '') {
  const configHeaders = {
    Accept: 'audio/mpeg',
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
  };

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
   * @returns
   */
  function say(text, voice, filePath) {
    text = sanitize(text);

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`;
    return from(
      axios(url, {
        method: 'post',
        data: { text },
        headers: configHeaders,
        responseType: 'stream',
      })
    ).pipe(
      catchError((error) => {
        console.error(`${error.response.status}: ${error.response.statusText}`);
        if (error?.response?.data?.error?.message) {
          console.error(error.response.data.error.message);
        }
        return throwError(() => error);
      }),
      retry({ count: 3, delay: 5000 }),
      switchMap((stream) => streamToFile(stream, filePath)),
      map(() => filePath)
    );
  }

  return {
    say,
  };
}

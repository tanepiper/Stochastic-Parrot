import AWS from 'aws-sdk';
import crypto from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { catchError, Observable, of, throwError } from 'rxjs';
import { concatMap, retry, tap } from 'rxjs/operators';

export const randomFloat = () =>
  crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/**
 * Get a random floating pont number between -1 and 1, or between 0 and 1 if onlyPositive is true
 * @returns {number} A random number between -1 and 1
 */
export const randomNumber = (onlyPositive = false) =>
  parseFloat(
    (randomFloat(1) * onlyPositive
      ? 1
      : randomFloat(1) >= 0.5
      ? 1
      : -1
    ).toFixed(2)
  );

/**
 * Sanitize a string for use with apis
 * @param {string} string
 * @returns {string}
 */
export function sanitize(string) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  const reg = /[&<>"'/]/gi;
  return string.replace(reg, (match) => map[match]);
}

/**
 * Clean up any characters that are not ASCII or Emoji characters and remove any HTML tags
 * @param {string} inputString
 * @returns
 */
export function sanitizeString(inputString) {
  // Remove HTML tags from the input string
  let strippedString = inputString.replace(/(<([^>]+)>)/gi, '');
  strippedString = strippedString.replace(/\u00A0/g, ' ');

  // Remove any special characters that are not ASCII or Emoji characters
  return strippedString.replace(
    /[^\p{L}\p{M}\x00-\x7F\uD800-\uDBFF\uDC00-\uDFFF]/gu,
    ''
  );
}

/**
 * A function that accepts an Observable value that it pipes through catchError and retry operators
 * The catchError operator has logic to check for HTTP status codes and log the error, and checks for
 * different shenanigans like no response from the server, or too many requests
 * The retry operator will retry the request up to the number of times specified in the retryConfig
 * If there is no error, the Observable continues as normal
 * @param {*} delayConfig
 * @returns
 */
export function errorHandlerWithDelay(
  retryConfig = { count: 3, delay: 10000 }
) {
  let retries = 0;
  return (source) =>
    source.pipe(
      catchError((error) => {
        const response = error?.response ?? error;
        if (!response?.status) {
          console.error(`No response status from server: ${error.code}`);
          if (response?.config?.url) {
            console.error(`URL: ${response.config.url}`);
          }
        } else if (response?.status === 401) {
          console.error('Unable to process request, please check your API key');
          process.exit(1);
        } else if (response?.status === 429) {
          console.error(
            `Too many requests, trying again in ${retryConfig.delay}ms`
          );
        } else {
          console.error(`${response.status}: ${response.statusText}`);
        }
        if (response?.data?.error?.message) {
          console.error(response.data.error.message);
        }

        retries++;
        if (retries >= retryConfig.count) {
          console.error(`Unable to process request after ${retries} retries`);
          return of(error);
        }
        console.log(`Retrying... (${retries}/${retryConfig.count})`);

        return throwError(() => error);
      }),
      retry(retryConfig)
    );
}

export async function S3UploadFile(key, sourceFile, bucket) {
  const client = new AWS.S3({
    region: 'eu-west-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });

  const fileData = await readFile(sourceFile);

  const result = await client
    .upload({
      Bucket: bucket,
      Key: key,
      Body: fileData,
    })
    .promise();

  const { Location } = result;
  return Location;
}

/**
 * Takes a Axios request stream and saves it to a file
 * @param {import('axios').AxiosResponse} stream The Axios response stream
 * @param {string} filePath The filePath to save the stream to
 * @returns
 */
export function streamToFile(stream, filePath) {
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
 * Write the repsponse from an Axios request to a file
 * @param {string} file The file to write to
 * @returns {Observable} An Observable that writes the response to a file
 */
export function writeResponseToFile(filePath) {
  return (source) =>
    source.pipe(
      tap(async (response) => {
        await writeFile(
          `${filePath}/${response.id}.json`,
          JSON.stringify(response, null, 2),
          {
            encoding: 'utf8',
            flag: 'w',
          }
        );
      })
    );
}

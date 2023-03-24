import crypto from 'node:crypto';
import { catchError, throwError, timer } from 'rxjs';
import { retry, take } from 'rxjs/operators';

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
  const strippedString = inputString.replace(/(<([^>]+)>)/gi, '');

  // Remove any special characters that are not ASCII or Emoji characters
  return strippedString.replace(/[^\x00-\x7F]/g, '');
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
  { count = 3, delay = 10000 } = { count: 3, delay: 10000 }
) {
  let retries = 0;
  return (source) =>
    source.pipe(
      catchError((error) => {
        const { response } = error || {};
        if (!response?.status) {
          console.error(`No response status from server: ${error.code}`);
          if (response?.config?.url) {
            console.error(`URL: ${response.config.url}`);
          }
        } else if (response?.status === 401) {
          throw new Error(
            'Unable to process request, please check your API key'
          );
        } else if (response?.status === 429) {
          console.error(`Too many requests, trying again in ${delay}ms`);
        } else {
          console.error(`${response.status}: ${response.statusText}`);
        }
        if (response?.data?.error?.message) {
          console.error(response.data.error.message);
        }

        retries++;
        if (retries >= count) {
          console.error(`Unable to process request after ${retries} retries`);
          return throwError(() => error);
        }

        return of(error).pipe(
          delay(delay),
          tap(() => {
            console.log(`Retrying... (${retries}/${count})`);
          })
        );
      })
    );
}

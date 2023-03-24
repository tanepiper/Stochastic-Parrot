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
  const strippedString = inputString.replace(/(<([^>]+)>)/ig, '');

  // Remove any special characters that are not ASCII or Emoji characters
  return strippedString.replace(/[^\x00-\x7F]/g, '');
}

/**
 * Returns a function that takes an observable and returns an observable that will retry the request if it fails
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
        // console.log(response);
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
          return throwError(() => error);
        }
        console.log(`Retrying... (${retries}/${retryConfig.count})`);

        return of(error);
      }),
      retry(retryConfig)
    );
}

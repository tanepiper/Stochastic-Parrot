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
        if (response?.status === 401) {
          console.error('Unable to process request, please check your API key');
          process.exit(1);
        }
        if (response?.status === 429) {
          console.error(
            `Too many requests, trying again in ${retryConfig.delay}ms`
          );
        } else {
          console.error(
            `${response.status}: ${response.statusText}`
          );
        }
        if (response?.data?.error?.message) {
          console.error(response.data.error.message);
        }

        if (retries < retryConfig.count) {
          retries++;
          console.log(`Retrying... (${retries}/${retryConfig.count})`);
        } else {
          console.error(`Unable to process request after ${retries} retries`);
        }
        return throwError(() => error);
      }),
      retry(retryConfig)
    );
}

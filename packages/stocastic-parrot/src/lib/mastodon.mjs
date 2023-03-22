import generator from 'megalodon';
import { from, throwError } from 'rxjs';
import {
  concatMap,
  map,
  switchMap,
  retry,
  catchError,
  scan,
} from 'rxjs/operators';
import { createReadStream } from 'node:fs';
import textract from 'textract';

const debugMode = process.env.DEBUG_MODE === 'true';
const CHAT_TOOT_HASHTAGS = '#StochasticParrot #ChatGPT';
const IMAGE_TOOT_HASHTAGS = '#StochasticParrot #ChatGPT';

/**
 * Function that splits up a large piece of text down into arrays of text
 * no more than 500 characters long. This is required for Mastodon.
 * @param {string} messageToToot
 * @param {boolean} withMedia
 * @returns {string[]} Array of strings to toot
 */
function splitToots(messageToToot, withMedia = false) {
  const toots = [];
  const maxLen = toots.length > 0 ? 500 : 470;

  while (messageToToot.length > 0) {
    let status = '';
    let inCodeBlock = false;
    if (messageToToot.length >= maxLen) {
      const parts = messageToToot.split(' ');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '```' && !inCodeBlock) {
          inCodeBlock = !inCodeBlock;
          break;
        } else if (parts[i] === '```' && inCodeBlock) {
          inCodeBlock = !inCodeBlock;
        }
        if (status.length + parts[i].length >= maxLen) {
          break;
        }
        status = `${status} ${parts[i]}`;
      }
      messageToToot = messageToToot.substring(status.length);
      if (toots.length === 0) {
        status = `${status}\n\n${CHAT_TOOT_HASHTAGS}`;
      }
    } else {
      status = `${messageToToot}`;
      if (toots.length === 0) {
        status = `${status}\n\n${
          withMedia ? IMAGE_TOOT_HASHTAGS : CHAT_TOOT_HASHTAGS
        }`;
      }
      messageToToot = '';
    }
    toots.push(status.trim());
  }
  return toots;
}

/**
 * Create a Mastodon client
 * @param {*} accessToken
 * @param {*} site
 * @returns
 */
export function createMastodonClient(
  accessToken,
  site = 'https://mastodon.social'
) {
  const mastodon = generator.default('mastodon', site, accessToken);

  /**
   * Posts a message to Mastodon, splitting it up into multiple toots if necessary.
   * You can also pass in an array of media IDs to attach to the first toot.
   *
   * @param {string} postMessage The request body of the toot
   * @param {string[]=} mediaIds Optional array of media IDs to attach to the first toot
   * @returns
   */
  function sendToots(postMessage, mediaIds = []) {
    let messageParts = splitToots(postMessage, mediaIds.length > 0);
    let firstTootUrl = '';
    let lastTootId = '';

    return from(messageParts).pipe(
      concatMap((status) => {
        const options = { status, visibility: 'public' };
        if (lastTootId) {
          options.in_reply_to_id = lastTootId;
        }
        if (mediaIds.length > 0 && !lastTootId) {
          options.media_ids = mediaIds;
        }
        return from(mastodon.postStatus(status, options)).pipe(
          map((res) => res.data),
          catchError((error) => {
            console.error(
              `${error.response.status}: ${error.response.statusText}`
            );
            return throwError(() => error);
          }),
          retry({ count: 3, delay: 1000 }),
          map((data) => {
            if (!firstTootUrl) {
              firstTootUrl = data.url;
            }
            lastTootId = data.id;
            return firstTootUrl;
          })
        );
      })
    );
  }

  /**
   * Upload an image to Mastodon and return the media ID
   * @param {string} filePath
   * @returns
   */
  function postMedia(filePath) {
    return from(
      mastodon.uploadMedia(createReadStream(filePath), {
        description: 'An image generated by ChatGPT with no prompt',
      })
    ).pipe(
      map((res) => res.data),
      map((data) => data.id)
    );
  }

  /**
   *
   * @returns
   */
  function getLocalTimeline(limit = 1) {
    return from(mastodon.getLocalTimeline({ limit })).pipe(
      switchMap((res) => from(res.data)),
      concatMap((toot) =>
        from(
          new Promise((resolve) =>
            textract.fromBufferWithMime(
              'text/html',
              Buffer.from(toot.content),
              (err, data) => resolve(data)
            )
          )
        ).pipe(scan((acc, data) => [...acc, data], []))
      )
    );
  }

  return {
    postMedia,
    sendToots,
    getLocalTimeline,
  };
}

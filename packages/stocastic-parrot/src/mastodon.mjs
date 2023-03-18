import generator from 'megalodon';
import { writeFile } from 'node:fs/promises';

const debugMode = process.env.DEBUG_MODE === 'true';

export function createMastodonClient(
  accessToken,
  site = 'https://mastodon.social'
) {
  const client = generator.default('mastodon', site, accessToken);
  return client;
}

const FIRST_TOOT_HASHTAGS = '\n\n#StochasticParrot #ChatGPT';

/**
 * Send a message to Mastodon, if the message is to long this method
 * splits the text down to 500 characters and sends it in multiple
 * toots as replies to the first toot.
 *
 * @param {*} mastodon The Mastodon client
 * @param {string} messageLeft The message to send to Mastodon
 * @param {string=} in_reply_to_id The ID of the toot to reply to
 * @returns {Promise<string>} The URL of the first toot
 */
export async function sendToMastodon(mastodon, messageLeft, in_reply_to_id) {
  let firstToolUrl = '';
  let status = '';
  const maxLen = in_reply_to_id ? 500 : 470;

  if (messageLeft.length >= maxLen) {
    const parts = messageLeft.split(' ');
    for (let i = 0; i < parts.length; i++) {
      if (status.length + parts[i].length >= maxLen) {
        break;
      }
      status = `${status} ${parts[i]}`;
    }
    messageLeft = messageLeft.substring(status.length);
    if (!in_reply_to_id) {
      status = `${status}${FIRST_TOOT_HASHTAGS}`;
    }
  } else {
    status = `${messageLeft}`;
    if (!in_reply_to_id) status = `${status}${FIRST_TOOT_HASHTAGS}`;
    messageLeft = '';
  }

  const options = { status, visibility: 'public' };
  if (in_reply_to_id) {
    options.in_reply_to_id = in_reply_to_id;
  }

  try {
    if (!debugMode) {
      const result = await mastodon.postStatus(status, options);
      if (!in_reply_to_id) {
        firstToolUrl = result.data.url;
      }
      if (messageLeft.length > 0) {
        sendToMastodon(mastodon, messageLeft, result.data.id);
      }
    }
  } catch (e) {
    await writeFile('debug.json', JSON.stringify(e, null, 2), {
      encoding: 'utf8',
      flag: 'w',
    });
    console.log('Failed to post to Mastodon');
    console.log(e);
  }

  return firstToolUrl;
}

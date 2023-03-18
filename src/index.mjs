#!/usr/bin/env node

import { createOpenAIInstance } from './openai.mjs';
import generator from 'megalodon';
import dotenv from 'dotenv';
import { randomNumber } from './lib.mjs';

dotenv.config();
const debugMode = process.env.DEBUG_MODE === 'true';

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);
const mastodon = generator.default(
  'mastodon',
  'https://mastodon.social',
  process.env.MASTODON_ACCESS_TOKEN
);

const FIRST_TOOT_HASHTAGS = '\n\n#StochasticParrot #ChatGPT';

/**
 * Send a message to Mastodon, if the message is to long this method
 * splits the text down to 500 characters and sends it in multiple
 * toots as replies to the first toot.
 *
 * @param {string} messageLeft The message to send to Mastodon
 * @param {string=} in_reply_to_id The ID of the toot to reply to
 */
async function sendToMasto(messageLeft, in_reply_to_id) {
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
      if (messageLeft.length > 0) {
        sendToMasto(messageLeft, result.data.id);
      }
    }
  } catch (e) {
    console.log('Failed to post to Mastodon');
  }
}

/**
 *
 * @returns Gets an OpenAI completion
 */
async function getOpenAICompletion() {
  try {
    const response = await openAI.createChatCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: '' }],
      frequency_penalty: randomNumber(),
      presence_penalty: randomNumber(),
      temperature: randomNumber(true),
      max_tokens: 200,
    });

    const { content } = response.data.choices[0].message;
    return content;
  } catch (e) {
    console.log(e)
    console.log('Failed to get completion');
  }
}

const content = await getOpenAICompletion();
await sendToMasto(content);

console.log('Done!');

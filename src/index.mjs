import { createOpenAIInstance } from './openai.mjs';
import generator from 'megalodon';
import dotenv from 'dotenv';

dotenv.config();

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY, '/chat');
const mastodon = generator.default(
  'mastodon',
  'https://mastodon.social',
  process.env.MASTODON_ACCESS_TOKEN
);

const append = '\n\n#StochasticParrot #ChatGPT';

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
    messageLeft = messageLeft.substr(status.length);
    if (!in_reply_to_id) {
      status = `${status}${append}`;
    }
  } else {
    status = `${messageLeft}`;
    if (!in_reply_to_id) status = `${status}${append}`;
    messageLeft = '';
  }

  const options = { status, visibility: 'public' };
  if (in_reply_to_id) {
    options.in_reply_to_id = in_reply_to_id;
  }

  try {
    const result = await mastodon.postStatus(status, options);
    if (messageLeft.length > 0) {
      sendToMasto(messageLeft, result.data.id);
    }
  } catch (e) {
    console.log('Failed to post');
  }
}

const response = await openAI.createCompletion({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '' }],
  frequency_penalty: 1,
  presence_penalty: 1,
  temperature: 0.8,
  max_tokens: 200,
});

const { content } = response.data.choices[0].message;

await sendToMasto(content);

console.log('Done!')

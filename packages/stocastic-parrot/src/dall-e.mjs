#!/usr/bin/env node

import dotenv from 'dotenv';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createMastodonClient } from './mastodon.mjs';
import { createOpenAIInstance } from './openai.mjs';

dotenv.config();

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);
const mastodon = createMastodonClient(process.env.MASTODON_ACCESS_TOKEN);
const filePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'dall-e')
  .split(':')[1];

let response;
let retries = 0;
try {
  response = await openAI.getImages();
} catch (e) {
  console.log(e);
  if (retries === 3) {
    console.log('Failed to get chat from OpenAI: Exiting');
    process.exit(1);
  }
  retries++;
  console.log(`Failed to get chat from OpenAI: Retry ${retries}`);
  response = await openAI.getChat();
}

const { url } = response.data?.data?.[0];
console.log(url);

const imageData = await fetch(url).then((res) => res.arrayBuffer());
const imagePath = `${filePath}/${response.data.created}.png`
await writeFile(imagePath, Buffer.from(imageData), {
  flag: 'w',
});

const tootUrl = await mastodon.postMedia(imagePath);
console.log(tootUrl);
// await writeFile(
//   `${filePath}/${response.data.id}.json`,
//   JSON.stringify(response.data, null, 2),
//   { encoding: 'utf8', flag: 'w' }
// );
// const { content } = response.data.choices[0].message;
// if (!content) {
//   console.log('No content returned from OpenAI');
//   process.exit(1);
// }

// const toolUrl = await mastodon.sendToMastodon(content);
// if (!toolUrl) {
//   console.log('No tool URL returned from Mastodon');
//   process.exit(1);
// }

// console.log(toolUrl);

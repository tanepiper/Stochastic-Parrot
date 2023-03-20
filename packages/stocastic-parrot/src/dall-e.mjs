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
while (!response && retries < 3) {
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
  }
}

const { url } = response.data?.data?.[0];

console.log('Fetching image');
const imageData = await fetch(url).then((res) => res.arrayBuffer());
const imagePath = `${filePath}/${response.data.created}.png`;
await writeFile(imagePath, Buffer.from(imageData), {
  flag: 'w',
});

const tootUrl = await mastodon.postMedia(imagePath);
console.log(tootUrl);
console.log('Done');

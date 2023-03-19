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
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'src', 'entries')
  .split(':')[1];

let response;
try {
  response = await openAI.getChat();
} catch (e) {
  console.log('Failed to get chat from OpenAI');
  console.log(e);
  process.exit(1);
}

await writeFile(
  `${filePath}/${Date.now()}.json`,
  JSON.stringify(response.data, null, 2),
  { encoding: 'utf8', flag: 'w' }
);
const { content } = response.data.choices[0].message;
if (!content) {
  console.log('No content returned from OpenAI');
  process.exit(1);
}

const toolUrl = await mastodon.sendToMastodon(content);
if (!toolUrl) {
  console.log('No tool URL returned from Mastodon');
  process.exit(1);
}

console.log(toolUrl);

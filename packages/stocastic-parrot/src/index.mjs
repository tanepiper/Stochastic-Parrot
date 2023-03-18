#!/usr/bin/env node

import { createOpenAIInstance, getOpenAICompletion } from './openai.mjs';
import dotenv from 'dotenv';
import { createMastodonClient, sendToMastodon } from './mastodon.mjs';

dotenv.config();
const debugMode = process.env.DEBUG_MODE === 'true';

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);
const mastodon = createMastodonClient(process.env.MASTODON_ACCESS_TOKEN);

const content = await getOpenAICompletion(openAI);
if (!content) {
  console.log('No content returned from OpenAI');
  process.exit(1);
}

const toolUrl = await sendToMastodon(mastodon, content);
if (!toolUrl) {
  console.log('No tool URL returned from Mastodon');
  process.exit(1);
}

console.log(toolUrl);

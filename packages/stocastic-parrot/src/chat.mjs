#!/usr/bin/env node

import dotenv from 'dotenv';
import minimist from 'minimist';
import path from 'node:path';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { writeResponseToFile } from './lib/lib.mjs';
import { createMastodonClient } from './lib/mastodon.mjs';
import { createOpenAIInstance } from './lib/openai.mjs';

dotenv.config();

const { _, ...opts } = minimist(process.argv.slice(2));
let prompt = _?.[0] ?? '';
if (opts?.help) {
  console.log(`Usage: chat.mjs [prompt] <options>`);
  console.log(`Options:`);
  console.log(`  --help             Show this help message`);
  console.log(`  --mastodonToken    Mastodon access token`);
  console.log(`  --openAIToken      OpenAI access token`);
  console.log(`  --maxTokens        Max tokens to pass to chat`);
  process.exit(0);
}

console.log('🤖 Starting Stochastic Parrot - Creating Chat 🦜');

const OPEN_API_KEY = opts?.openAIToken ?? process.env.OPENAI_API_KEY;
const MASTODON_ACCESS_TOKEN =
  opts?.mastodonToken ?? process.env.MASTODON_ACCESS_TOKEN;
const max_tokens = opts?.maxTokens ?? 350;

const openAI = createOpenAIInstance(OPEN_API_KEY);
const mastodon = createMastodonClient(MASTODON_ACCESS_TOKEN);
const filePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'entries')
  .split(':')[1];

/**
 * Generate a chat response from OpenAI and post it to Mastodon, the
 * response is saved to the site for the site
 */
openAI
  .getChat(prompt, { max_tokens })
  .pipe(
    tap(() => console.log(`💾 Saving Response`)),
    writeResponseToFile(filePath),
    map((response) => {
      const { content } = response?.choices?.[0]?.message ?? '';
      if (!content) {
        throw new Error('No content returned from OpenAI');
      }
      const toot = `${prompt ? '💬' : '🦜'} ${content}`;
      console.log(`Creating Toot: ${toot}`);
      return toot;
    }),
    switchMap((content) => mastodon.sendToots(content)),
    map((tootUrl) => {
      if (!tootUrl) {
        throw new Error('No tool URL returned from Mastodon');
      }
      console.log(`Toot posted to Mastodon: ${tootUrl}`);
      return tootUrl;
    }),
    catchError((e) => {
      console.error(`Job Failed ${Date.now()} - ${e.message}`);
      process.exit(1);
    }),
    finalize(() => {
      console.log(`Job complete ${Date.now()}`);
      process.exit(0);
    })
  )
  .subscribe();

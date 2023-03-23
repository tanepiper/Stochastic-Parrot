#!/usr/bin/env node
import dotenv from 'dotenv';
import minimist from 'minimist';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { from } from 'rxjs';
import {
  catchError,
  concatMap,
  delay,
  finalize,
  map,
  switchMap,
} from 'rxjs/operators';
import { createElevenLabsClient } from './lib/eleven-labs.mjs';
import { createMastodonClient } from './lib/mastodon.mjs';
import { createOpenAIInstance } from './lib/openai.mjs';

/**
 * A script that runs the Dall-E image generation model from OpenAI and posts the result to Mastodon,
 * the image is also saved to the site public folder as a `.webp` for use in the site.
 *
 * @file dall-e.js
 * @author Tane Piper <me@tane.dev>
 * @license MIT
 * @version 0.0.1
 */

dotenv.config();

const { _, ...opts } = minimist(process.argv.slice(2));
let prompt = _?.[0] ?? ' '; // This should be an empty space
if (opts?.help) {
  console.log(`Usage: dall-e.mjs [prompt] <options>`);
  console.log(`Options:`);
  console.log(`  --help                   Show this help message`);
  console.log(`  --mastodonToken          Mastodon access token`);
  console.log(`  --openAIToken            OpenAI access token`);
  console.log(
    `  --textToAudioToken       Token for ElevenLabs text to audio API`
  );
  console.log(
    `  --maxTokens              Max tokens to use for the OpenAI prompt`
  );
  console.log(
    `  --voiceId                          The ID of the voice to use for the text to audio API`
  );
  console.log(`  --voiceStability          Voice stability setting`);
  console.log(`  --voiceSimilarityBoost    Voice similarity boost setting`);
  process.exit(0);
}

const OPEN_API_KEY = opts?.openAIToken ?? process.env.OPENAI_API_KEY;
const MASTODON_ACCESS_TOKEN =
  opts?.mastodonToken ?? process.env.MASTODON_ACCESS_TOKEN;
const TEXT_TO_AUDIO_API_KEY =
  opts?.textToAudioToken ?? process.env.TEXT_TO_AUDIO_API_KEY;

const max_tokens = opts?.maxTokens ?? 350;
const voiceId = opts?.voiceId ?? 'MF3mGyEYCl7XYWbV9V6O'; // Elli
const stability = opts?.voiceStability ?? 0.2;
const similarity_boost = opts?.voiceSimilarityBoost ?? 0.5;

const openAI = createOpenAIInstance(OPEN_API_KEY);
const mastodon = createMastodonClient(MASTODON_ACCESS_TOKEN);
const audioClient = createElevenLabsClient(TEXT_TO_AUDIO_API_KEY);
const entriesFilePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'entries')
  .split(':')[1];
const audioFilePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'audio')
  .split(':')[1];

/**
 * Subscribe to the Observable result of the OpenAI API call, then pipe the response through a series of
 * RxJS operators to get the image URL, download the image, convert it to a webp, save it to the site
 * public folder, then post it to Mastodon.
 */
openAI
  .getChat(prompt, { max_tokens })
  .pipe(
    switchMap((response) =>
      from(
        writeFile(
          `${entriesFilePath}/${response.id}.json`,
          JSON.stringify(response, null, 2),
          {
            encoding: 'utf8',
            flag: 'w',
          }
        )
      ).pipe(map(() => response))
    ),

    switchMap((response) => {
      const { content } = response?.choices?.[0]?.message ?? '';
      if (!content) {
        throw new Error('No content returned from OpenAI');
      }
      console.log('Generating Audio File...');
      return audioClient
        .say(content, voiceId, `${audioFilePath}/${response.id}.mp3`, {
          stability,
          similarity_boost,
        })
        .pipe(
          map(() => ({
            file: `${audioFilePath}/${response.id}.mp3`,
            description: content.substring(0, 1499),
          }))
        );
    }),
    concatMap(({ file, description }) => {
      console.log('Uploading Audio File...');
      return mastodon.postMedia(file, description).pipe(delay(10000));
    }),
    switchMap((media) => {
      console.log('Posting Audio File...');
      const status = prompt !== ' ' ? `💬` : `🦜`;
      return mastodon.sendToots(`${status}`, { media_ids: [media] });
    }),

    map((tootUrl) => {
      if (!tootUrl) {
        throw new Error('No tool URL returned from Mastodon');
      }
      console.log(`Toot posted to Mastodon: ${tootUrl}`);
      return tootUrl;
    }),
    catchError((e) => {
      console.error(`Job Failed ${Date.now()} - ${e.message}`);
      console.log(e);
      process.exit(1);
    }),
    finalize(() => {
      console.log(`Job complete ${Date.now()}`);
      process.exit(0);
    })
  )
  .subscribe();

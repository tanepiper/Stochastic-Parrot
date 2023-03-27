#!/usr/bin/env node
import dotenv from 'dotenv';
import minimist from 'minimist';
import path from 'node:path';
import {
  catchError,
  concatMap,
  delay,
  finalize,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';
import { createElevenLabsClient } from './lib/eleven-labs.mjs';
import { createAWSS3Client } from './lib/index.mjs';
import { writeResponseToFile } from './lib/lib.mjs';
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

const BUCKET_NAME = 'stochastic-parrot';

const { _, ...opts } = minimist(process.argv.slice(2));
let prompt = _?.[0] ?? ''; // This should be an empty space
if (opts?.help) {
  console.log(`Usage: audio.mjs [prompt] <options>`);
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
const S3Client = createAWSS3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});
const entriesFilePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'audio')
  .split(':')[1];
const audioFilePath = path
  .resolve(`${import.meta.url}`, '..', '..', 'tmp')
  .split(':')[1];

/**
 * Subscribe to the Observable result of the OpenAI API call, then pipe the response through a series of
 * RxJS operators to get the image URL, download the image, convert it to a webp, save it to the site
 * public folder, then post it to Mastodon.
 */
console.log('🤖 Starting Stochastic Parrot - Creating Audio 🔈');

openAI
  .getChat(prompt, { max_tokens })
  .pipe(
    writeResponseToFile(entriesFilePath),
    switchMap((response) => {
      const { content } = response?.choices?.[0]?.message ?? '';
      if (!content) {
        throw new Error('No content returned from OpenAI');
      }
      console.log(`🔈 Generating Audio File... \n\n${content}`);
      return audioClient
        .say(content, `${audioFilePath}/${response.id}.mp3`, voiceId, {
          stability,
          similarity_boost,
        })
        .pipe(
          tap(() => console.log(`💾 Saving Audio File to S3`)),
          switchMap(() =>
            S3Client.uploadFile(
              `${audioFilePath}/${response.id}.mp3`,
              BUCKET_NAME,
              `audio/${response.id}.mp3`
            ).pipe(tap((s3File) => `🔗 Audio File URL: ${s3File}`))
          ),
          map(() => ({
            file: `${audioFilePath}/${response.id}.mp3`,
            description: content.substring(0, 1499),
          }))
        );
    }),
    tap(() => console.log('🔼 Uploading Audio File to Mastodon...')),
    concatMap(({ file, description }) =>
      mastodon.postMedia(file, description).pipe(delay(10000))
    ),
    tap(() => console.log('💬 Posting Audio File...')),
    switchMap((media) =>
      mastodon.sendToots(prompt ? `💬` : `🦜`, { media_ids: [media] })
    ),
    tap((tootUrl) => console.log(`Toot posted to Mastodon: ${tootUrl}`)),
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

#!/usr/bin/env node
import dotenv from 'dotenv';
import minimist from 'minimist';
import { createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
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
import { createCreatomateClient } from './lib/creatomate.mjs';
import { createElevenLabsClient } from './lib/eleven-labs.mjs';
import { S3UploadFile } from './lib/lib.mjs';
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
let topic = _?.[0] ?? ' '; // This should be an empty space
if (opts?.help) {
  console.log(`Usage: dall-e.mjs [prompt] <options>`);
  console.log(`Options:`);
  console.log(`  --help                   Show this help message`);
  console.log(`  --mastodonToken          Mastodon access token`);
  console.log(`  --openAIToken            OpenAI access token`);
  console.log(`  --creatoMaticToken       Token for Creatomatic video API`);
  process.exit(0);
}

const OPEN_API_KEY = opts?.openAIToken ?? process.env.OPENAI_API_KEY;
const MASTODON_ACCESS_TOKEN =
  opts?.mastodonToken ?? process.env.MASTODON_ACCESS_TOKEN;
const CREATOMATIC_API_KEY =
  opts?.creatoMaticToken ?? process.env.CREATOMATIC_API_KEY;

const templates = {
  happyVideo: {
    id: 'cb5ed739-810b-45a4-be18-7054e16500a9',
    prompt: `In the style of short captions for a social media video, Generate a random short story broken down into 4 short sections, each section getting more depressing, give the result as a JSON object with the property 'story' as an array of strings, and a property 'hashtags' which is a string of hashtags that would suit the story. Each string should be max 100 characters.`,
  },
  motivationalQuote: {
    id: 'f3ab36d7-9fef-415c-b966-c81bb587715a',
    prompt: `Create a funny fake motivational quote. Return the result as a JSON object with the property 'story' as an array with one quote, and a property 'hashtags' which is a string of hashtags related to the quote. Each string should be max 200 characters.`,
  },
};
const selectedTemplate = templates[opts?.template ?? 'motivationalQuote'];
const prompt = topic
  ? `The topic is ${topic}. ${selectedTemplate.prompt}`
  : selectedTemplate.prompt;

const BUCKET_NAME = 'stochastic-parrot';

const max_tokens = opts?.maxTokens ?? 350;

const openAI = createOpenAIInstance(OPEN_API_KEY);
const mastodon = createMastodonClient(MASTODON_ACCESS_TOKEN);
const video = createCreatomateClient(CREATOMATIC_API_KEY);
const entriesFilePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'video')
  .split(':')[1];
const videoFilePath = path
  .resolve(`${import.meta.url}`, '..', '..', 'tmp')
  .split(':')[1];

/**
 * Subscribe to the Observable result of the OpenAI API call, then pipe the response through a series of
 * RxJS operators to get the image URL, download the image, convert it to a webp, save it to the site
 * public folder, then post it to Mastodon.
 */
console.log('🤖 Starting Stochastic Parrot - Creating Video 🔈');

openAI
  .getChat(prompt, { max_tokens })
  .pipe(
    tap(async (response) => {
      console.log(`💾 Saving Response`);
      await writeFile(
        `${entriesFilePath}/${response.id}.json`,
        JSON.stringify(response, null, 2),
        {
          encoding: 'utf8',
          flag: 'w',
        }
      );
    }),
    switchMap((response) => {
      const { content } = response?.choices?.[0]?.message ?? '';
      if (!content) {
        throwError(() => 'No content returned from OpenAI');
      }
      const code =
        content.charAt(0) === '{' ? content : content.split('```')[1];
      let body;
      try {
        body = JSON.parse(code);
      } catch (e) {
        throwError(() => 'Invalid JSON returned from OpenAI');
      }

      const modifications = Object.fromEntries(
        body?.story?.map((m, i) => [`Text-${i + 1}`, m])
      );
      console.log(`📹 Generating Video`);
      return video.generateVideo(selectedTemplate.id, modifications).pipe(
        switchMap((videoResponse) => {
          return video
            .downloadVideo(
              videoResponse.url,
              `${videoFilePath}/${response.id}.mp4`
            )
            .pipe(map(() => ({ response, body })));
        }),
        tap(async ({ response }) => {
          await S3UploadFile(
            `video/${response.id}.mp4`,
            `${videoFilePath}/${response.id}.mp4`,
            BUCKET_NAME
          );
        }),
        tap((s3File) => `🔗 Audio File URL: ${s3File}`),
        map(({ response, body }) => ({
          file: `${videoFilePath}/${response.id}.mp4`,
          description: Object.values(modifications).join(' '),
          body: body?.hashtags ?? '',
        }))
      );
    }),
    concatMap(({ file, description, body }) => {
      console.log('🔼 Uploading Video File to Mastodon...');
      return mastodon.postMedia(file, description).pipe(
        map((media) => ({ media, body })),
        delay(10000)
      );
    }),
    switchMap(({ media, body }) => {
      console.log('💬 Posting Video File...');
      const status = `${prompt !== ' ' ? '💬' : '🦜'} ${body}`;
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

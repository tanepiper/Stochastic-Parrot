#!/usr/bin/env node
import dotenv from 'dotenv';
import minimist from 'minimist';
import path from 'node:path';
import { throwError } from 'rxjs';
import {
  catchError,
  concatMap,
  delay,
  finalize,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';
import { createCreatomateClient, videoTemplates } from './lib/creatomate.mjs';
import { S3UploadFile, writeResponseToFile } from './lib/lib.mjs';
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
  console.log(`  --template               The template to use`);
  Object.keys(templates).forEach((key) => {
    console.log(`    ${key}`);
  });
  process.exit(0);
}

const OPEN_API_KEY = opts?.openAIToken ?? process.env.OPENAI_API_KEY;
const MASTODON_ACCESS_TOKEN =
  opts?.mastodonToken ?? process.env.MASTODON_ACCESS_TOKEN;
const CREATOMATIC_API_KEY =
  opts?.creatoMaticToken ?? process.env.CREATOMATIC_API_KEY;

const templateName = opts?.template ?? 'fiveFacts';
const selectedTemplate = videoTemplates[templateName];
console.log(templateName);

const prompt = topic
  ? `${selectedTemplate.prompt.replace('[about] ', `about ${topic} `)}`
  : selectedTemplate.prompt.replace('[about] ', '');

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
    writeResponseToFile(entriesFilePath),
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
      if (body?.introText) {
        modifications['Intro-Text'] = body.introText;
      }
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
      const status = `${topic !== ' ' ? '💬' : '🦜'} ${body}`;
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

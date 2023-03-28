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
import { createAWSS3Client } from './lib/index.mjs';
import { writeResponseToFile } from './lib/lib.mjs';
import { createMastodonClient } from './lib/mastodon.mjs';
import { createOpenAIInstance } from './lib/openai.mjs';
import { AWSS3Config } from './config.mjs';

/**
 * A script to generate a video from a prompt using OpenAI's Chat API
 *
 * @file video.js
 * @author Tane Piper <me@tane.dev>
 * @license MIT
 * @version 0.0.1
 */

dotenv.config();

const { _, ...opts } = minimist(process.argv.slice(2));
let prompt = _?.[0] ?? ''; // This should be an empty space
if (opts?.help) {
  console.log(`Usage: chat.mjs [prompt] <options>`);
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

const BUCKET_NAME = 'stochastic-parrot';

const max_tokens = opts?.maxTokens ?? 350;

const openAI = createOpenAIInstance(OPEN_API_KEY);
const mastodon = createMastodonClient(MASTODON_ACCESS_TOKEN);
const video = createCreatomateClient(CREATOMATIC_API_KEY);
const S3Client = createAWSS3Client({
  ...AWSS3Config.client,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});
const entriesFilePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'video')
  .split(':')[1];
const videoFilePath = path
  .resolve(`${import.meta.url}`, '..', '..', 'tmp')
  .split(':')[1];

console.log('🤖 Starting Stochastic Parrot - Creating Video 🎬');

/**
 * Get a response from OpenAI, then generate a video from the response,
 * then upload the video to S3, then post the video to Mastodon
 */
openAI
  .getChat(prompt, { max_tokens }, selectedTemplate.prompt)
  .pipe(
    writeResponseToFile(entriesFilePath),
    map((response) => {
      const { content } = response?.choices?.[0]?.message ?? '';
      if (!content) {
        throwError(() => 'No content returned from OpenAI');
      }
      const code =
        content?.charAt(0) === '{' ? content : content.split('```')[1];
      let jsonBody;
      try {
        jsonBody = JSON.parse(code);
      } catch (e) {
        throwError(() => 'Invalid JSON returned from OpenAI');
      }
      return { response, jsonBody };
    }),
    switchMap(({ response, jsonBody }) => {
      const { introText, body } = jsonBody;
      const modifications = Object.fromEntries(
        body?.map((m, i) => [`Text-${i + 1}`, m]) ?? []
      );
      if (introText) {
        modifications['Intro-Text'] = introText;
      }
      console.log(`📹 Generating Video`);
      return video.generateVideo(selectedTemplate.id, modifications).pipe(
        tap(() => console.log(`🔽 Downloading Video File...`)),
        switchMap((videoResponse) =>
          video
            .downloadVideo(
              videoResponse.url,
              `${videoFilePath}/${response.id}.mp4`
            )
            .pipe(map(() => ({ response, jsonBody })))
        ),
        tap(() => console.log(`🔼 Uploading Video File to S3...`)),
        switchMap(({ response, jsonBody }) =>
          S3Client.uploadFile(
            `${videoFilePath}/${response.id}.mp4`,
            AWSS3Config.bucket,
            `video/${response.id}.mp4`
          ).pipe(
            tap((s3File) => `🔗 Audio File URL: ${s3File}`),
            map(() => ({ response, jsonBody }))
          )
        ),
        map(({ response, jsonBody }) => ({
          file: `${videoFilePath}/${response.id}.mp4`,
          description: Object.values(modifications).join(' '),
          status: Array.isArray(jsonBody?.hashtag)
            ? jsonBody?.hashtag.join(' ')
            : `${jsonBody?.hashtag ?? ''}`.trim(),
        }))
      );
    }),
    tap(() => console.log('🔼 Uploading Video File to Mastodon...')),
    concatMap(({ file, description, status }) =>
      mastodon
        .postMedia(file, description)
        .pipe(map((media) => ({ media, status })))
    ),
    tap(() => console.log('💬 Posting Video File...')),
    concatMap(({ media, status }) => {
      console.log(media, status)
      return mastodon.sendToots(`${prompt ? '💬' : '🦜'} ${status}`, {
        media_ids: [media],
      })
    }),
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

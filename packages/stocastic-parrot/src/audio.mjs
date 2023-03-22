#!/usr/bin/env node
import dotenv from 'dotenv';
import minimist from 'minimist';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { from } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { textToAudio } from './lib/lib.mjs';
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
  console.log(`  --help             Show this help message`);
  console.log(`  --mastodonToken    Mastodon access token`);
  console.log(`  --openAIToken      OpenAI access token`);
  console.log(`  --imageQuality     Image quality for WebP file, default 80`);
  console.log(
    `  --imageSize        Image size for Dall-E model, default 1024x1024`
  );
  console.log(`  --numImages        Number of images to generate, default 1`);
  process.exit(0);
}

const OPEN_API_KEY = opts?.openAIToken ?? process.env.OPENAI_API_KEY;
const MASTODON_ACCESS_TOKEN =
  opts?.mastodonToken ?? process.env.MASTODON_ACCESS_TOKEN;
const TEXT_TO_AUDIO_API_KEY =
  opts?.textToAudioToken ?? process.env.TEXT_TO_AUDIO_API_KEY;

const ARNOLD_VOICE = 'VR6AewLTigWG4xSOukaG';

const openAI = createOpenAIInstance(OPEN_API_KEY);
const mastodon = createMastodonClient(MASTODON_ACCESS_TOKEN);
const audioClient = textToAudio(TEXT_TO_AUDIO_API_KEY, ARNOLD_VOICE);
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
  .getChat(prompt)
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
      return audioClient.say('this is a test')
      //return from(audioClient.say(content).then((r) => r.data));
    }),
    switchMap((audioData) => {
      const buffer = Buffer.from(audioData);
      return from(
        writeFile(`${audioFilePath}/${'audio'}.mp3`, buffer, {
          flag: 'w',
        })
      ).pipe(map(() => `${audioFilePath}/${'audio'}.mp3`));
    }),

    // map((tootUrl) => {
    //   if (!tootUrl) {
    //     throw new Error('No tool URL returned from Mastodon');
    //   }
    //   console.log(`Toot posted to Mastodon: ${tootUrl}`);
    //   return tootUrl;
    // }),
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

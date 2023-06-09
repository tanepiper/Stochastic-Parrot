#!/usr/bin/env node
import dotenv from 'dotenv';
import minimist from 'minimist';
import path from 'node:path';
import { from } from 'rxjs';
import {
  catchError,
  concatMap,
  finalize,
  map,
  mergeScan,
  switchMap,
  tap,
  toArray,
} from 'rxjs/operators';
import sharp from 'sharp';
import { AWSS3Config } from './config.mjs';
import { createAWSS3Client } from './lib/index.mjs';
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
const BUCKET_NAME = 'stochastic-parrot';

const webpFileQuality = opts?.imageQuality ?? 80;
const dalleImageSize = opts?.imageSize ?? '512x512';
const dalleNumberOfImages = opts?.numImages ?? 4;

const openAI = createOpenAIInstance(OPEN_API_KEY);
const mastodon = createMastodonClient(MASTODON_ACCESS_TOKEN);
const S3Client = createAWSS3Client({
  ...AWSS3Config.client,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});
const filePath = path
  .resolve(`${import.meta.url}`, '..', '..', 'tmp')
  .split(':')[1];

/**
 * Subscribe to the Observable result of the OpenAI API call, then pipe the response through a series of
 * RxJS operators to get the image URL, download the image, convert it to a webp, save it to the site
 * public folder, then post it to Mastodon.
 */
openAI
  .getImages(prompt, { n: dalleNumberOfImages, size: dalleImageSize })
  .pipe(
    /**
     * With the images, we need to download them, convert them to webp, save them to the site public
     */
    switchMap((response) =>
      from(
        response.data.map((data) => ({
          created: response.created,
          url: data.url,
        }))
      ).pipe(
        /**
         * Download the image, convert it to a webp, save it to the site public folder
         */
        concatMap(({ url, created }) =>
          from(fetch(url).then((res) => res.arrayBuffer())).pipe(
            map((buffer) => ({
              buffer: Buffer.from(buffer),
              created,
            }))
          )
        ),
        concatMap(({ buffer, created }, index) =>
          from(
            sharp(buffer)
              .webp({ quality: webpFileQuality })
              .toFile(`${filePath}/${created}.${index + 1}.webp`)
          ).pipe(map(() => `${created}.${index + 1}.webp`))
        ),
        tap((file) => console.log(`🔼 Uploading Image File to S3... ${file}`)),
        concatMap((fileName) =>
          S3Client.uploadFile(
            `${filePath}/${fileName}`,
            AWSS3Config.bucket,
            `dall-e/${fileName}`
          ).pipe(
            tap((s3File) => `🔗 Audio File URL: ${s3File}`),
            map(() => fileName)
          )
        ),
        map((fileName) => ({
          file: `${filePath}/${fileName}`,
          description: prompt
            ? prompt.substring(0, 1499)
            : 'A image generated by Dall-E with no prompt',
        })),
        concatMap(({ file, prompt }) => mastodon.postMedia(file, prompt)),
        toArray()
      )
    ),

    switchMap((media_ids) => {
      const status = prompt !== ' ' ? `💬` : `🦜`;
      return mastodon
        .sendToots(`${status}`, { media_ids })
        .pipe(mergeScan((acc, tootUrl) => [...new Set([...acc, tootUrl])], []));
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
      process.exit(1);
    }),
    finalize(() => {
      console.log(`Job complete ${Date.now()}`);
      process.exit(0);
    })
  )
  .subscribe();

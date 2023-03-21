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
  switchMap,
  take,
  tap,
  toArray,
} from 'rxjs/operators';
import sharp from 'sharp';
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

const webpFileQuality = opts?.imageQuality ?? 80;
const dalleImageSize = opts?.imageSize ?? '512x512';
const dalleNumberOfImages = opts?.numImages ?? 2;

const openAI = createOpenAIInstance(OPEN_API_KEY);
const mastodon = createMastodonClient(MASTODON_ACCESS_TOKEN);
const filePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'entries')
  .split(':')[1];

mastodon
  .getLocalTimeline(5)
  .pipe(
    map((toots) => toots.sort((a, b) => b.length - a.length)),
    take(1),
    map((toots) => toots[0].trim())
  )
  .pipe(
    tap((toot) => console.log(`🦻 ${toot}`)),
    switchMap((toot) =>
      openAI
        .getImages(toot, { n: dalleNumberOfImages, size: dalleImageSize })
        .pipe(
          switchMap((response) => {
            return from(
              response.data.map((data) => {
                return { created: response.created, url: data.url };
              })
            ).pipe(
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
                ).pipe(map(() => `${filePath}/${created}.${index + 1}.webp`))
              ),
              concatMap((imagePath) => mastodon.postMedia(imagePath)),
              toArray()
            );
          }),

          switchMap((media) => {
            const status = prompt !== ' ' ? `💬` : `🦜`;
            return mastodon.sendToots(`${status}`, media);
          }),
          map((tootUrl) => {
            if (!tootUrl) {
              throw new Error('No tool URL returned from Mastodon');
            }
            console.log(`Toot posted to Mastodon: ${tootUrl}`);
            return tootUrl;
          })
        )
    ),
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

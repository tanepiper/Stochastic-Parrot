#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'node:path';
import sharp from 'sharp';
import minimist from 'minimist';
import { from } from 'rxjs';
import { map, switchMap, catchError, finalize } from 'rxjs/operators';
import { createMastodonClient } from './mastodon.mjs';
import { createOpenAIInstance } from './openai.mjs';

dotenv.config();

const { _ } = minimist(process.argv.slice(2));
let prompt = _?.[0] ?? '';

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);
const mastodon = createMastodonClient(process.env.MASTODON_ACCESS_TOKEN);
const filePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'dall-e')
  .split(':')[1];

openAI
  .getImages(prompt)
  .pipe(
    map((response) => {
      const { url } = response?.data?.[0] ?? '';
      if (!url) {
        throw new Error('No images from OpenAI');
      }
      return { url, created: response.created };
    }),
    switchMap(({ url, created }) =>
      from(fetch(url).then((res) => res.arrayBuffer())).pipe(
        map((buffer) => ({ buffer: Buffer.from(buffer), created }))
      )
    ),
    switchMap(({ buffer, created }) =>
      from(
        sharp(buffer)
          .webp({ quality: 80 })
          .toFile(`${filePath}/${created}.webp`)
      ).pipe(map(() => `${filePath}/${created}.webp`))
    ),
    switchMap((imagePath) => from(mastodon.postMedia(imagePath))),
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

#!/usr/bin/env node

import dotenv from 'dotenv';
import minimist from 'minimist';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { from } from 'rxjs';
import {
  catchError,
  finalize,
  map,
  switchMap,
  concatMap,
  scan,
} from 'rxjs/operators';
import { createMastodonClient } from './mastodon.mjs';
import { createOpenAIInstance } from './openai.mjs';

dotenv.config();

const { _ } = minimist(process.argv.slice(2));
let prompt = _?.[0] ?? '';

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);
const mastodon = createMastodonClient(process.env.MASTODON_ACCESS_TOKEN);
const filePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'entries')
  .split(':')[1];

openAI
  .getChat(prompt)
  .pipe(
    switchMap((response) =>
      from(
        writeFile(
          `${filePath}/${response.id}.json`,
          JSON.stringify(response, null, 2),
          {
            encoding: 'utf8',
            flag: 'w',
          }
        )
      ).pipe(map(() => response))
    ),
    map((response) => {
      const { content } = response?.choices?.[0]?.message ?? '';
      if (!content) {
        throw new Error('No content returned from OpenAI');
      }
      return `${prompt ? '💬' : '🦜'} ${content}`;
    }),
    concatMap((content) =>
      mastodon.sendToots(content).pipe(
        scan((acc, tootUrl) => [...new Set([...acc, tootUrl])], []),
        map((tootUrls) => tootUrls.pop())
      )
    ),
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

#!/usr/bin/env node

import dotenv from 'dotenv';
import minimist from 'minimist';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { from, throwError } from 'rxjs';
import {
  catchError,
  concatMap,
  finalize,
  map,
  scan,
  switchMap,
} from 'rxjs/operators';
import { createMastodonClient } from './lib/mastodon.mjs';
import { createOpenAIInstance } from './lib/openai.mjs';

dotenv.config();

const { _, ...opts } = minimist(process.argv.slice(2));
let topic = _?.[0] ?? '';
if (opts?.help) {
  console.log(`Usage: poll.mjs [topic] <options>`);
  console.log(`Options:`);
  console.log(`  --help             Show this help message`);
  console.log(`  --mastodonToken    Mastodon access token`);
  console.log(`  --openAIToken      OpenAI access token`);
  console.log(`  --maxTokens        Max tokens to pass to chat`);
  console.log(`  --pollExpires      Poll expiration time in seconds`);
  process.exit(0);
}

const prompt = topic
  ? `Generate a poll question about ${topic} with 4 answers, give the result as a JSON object with the property 'question' as a string and 'answers' as an array of strings. Each answer should be max 50 characters.`
  : 'Generate a random poll question with 4 answers, give the result as a JSON object with the property `question` as a string and `answers` as an array of strings. Each answer should be max 50 characters.';

const OPEN_API_KEY = opts?.openAIToken ?? process.env.OPENAI_API_KEY;
const MASTODON_ACCESS_TOKEN =
  opts?.mastodonToken ?? process.env.MASTODON_ACCESS_TOKEN;
const max_tokens = opts?.maxTokens ?? 250;
const expires_in = opts?.pollExpires ?? 60 * 60 * 24; // 1 Day

const openAI = createOpenAIInstance(OPEN_API_KEY);
const mastodon = createMastodonClient(MASTODON_ACCESS_TOKEN);
const filePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'polls')
  .split(':')[1];

openAI
  .getChat(prompt, { max_tokens })
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
      return content.trim();
    }),
    map((content) => {
      const code = content.charAt(0) === '{' ? content : content.split('```')[1];
      let question, answers;
      try {
        const result = JSON.parse(code);
        question = result.question;
        answers = result.answers;
      } catch (e) {
        return throwError(() => 'Invalid JSON returned from OpenAI');
      }

      question = `${topic ? '💬' : '🦜'} ${question}`;
      return {
        question,
        poll: {
          options: answers,
          expires_in,
        },
      };
    }),
    concatMap(({ question, poll }) =>
      mastodon.sendToots(question, { poll }).pipe(
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
      process.exit(1);
    }),
    finalize(() => {
      console.log(`Job complete ${Date.now()}`);
      process.exit(0);
    })
  )
  .subscribe();

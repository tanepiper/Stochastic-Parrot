#!/usr/bin/env node

import dotenv from "dotenv";
import minimist from "minimist";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  catchError,
  concatMap,
  finalize,
  map,
  switchMap,
  take,
  tap,
} from "rxjs/operators";
import { createMastodonClient } from "./lib/mastodon.mjs";
import { createOpenAIInstance } from "./lib/openai.mjs";

dotenv.config();

const { _, ...opts } = minimist(process.argv.slice(2));
let prompt = _?.[0] ?? "";
if (opts?.help) {
  console.log(`Usage: chat.mjs [prompt] <options>`);
  console.log(`Options:`);
  console.log(`  --help             Show this help message`);
  console.log(`  --mastodonToken    Mastodon access token`);
  console.log(`  --openAIToken      OpenAI access token`);
  console.log(`  --maxTokens        Max tokens to pass to chat`);
  process.exit(0);
}

const OPEN_API_KEY = opts?.openAIToken ?? process.env.OPENAI_API_KEY;
const MASTODON_ACCESS_TOKEN =
  opts?.mastodonToken ?? process.env.MASTODON_ACCESS_TOKEN;
const max_tokens = opts?.maxTokens ?? 350;

const openAI = createOpenAIInstance(OPEN_API_KEY);
const mastodon = createMastodonClient(MASTODON_ACCESS_TOKEN);
const filePath = path
  .resolve(`${import.meta.url}`, "..", "..", "..", "site", "public", "entries")
  .split(":")[1];

mastodon
  .getLocalTimeline(5)
  .pipe(
    map((toots) => toots.sort((a, b) => b.length - a.length)),
    take(1)
  )
  .pipe(
    tap((toot) => console.log(`🦻 ${toot}`)),
    map((toot) => {
      prompt = `For the following toot: ${toot} - think of a response that would be suitable`;
      return prompt;
    }),
    switchMap((toot) =>
      openAI.getChat(toot, { max_tokens }).pipe(
        tap(async (response) => {
          await writeFile(
            `${filePath}/${response.id}.json`,
            JSON.stringify(response, null, 2),
            {
              encoding: "utf8",
              flag: "w",
            }
          );
        }),
        map((response) => {
          const { content } = response?.choices?.[0]?.message ?? "";
          if (!content) {
            throw new Error("No content returned from OpenAI");
          }
          const toot = `${prompt ? "💬" : "🦜"} ${content}`;
          console.log(`Creating Toot: ${toot}`);
          return toot;
        }),
        concatMap((content) =>
          mastodon
            .sendToots(content)
            .pipe(
              mergeScan((acc, tootUrl) => [...new Set([...acc, tootUrl])], [])
            )
        ),
        map((tootUrl) => {
          if (!tootUrl) {
            throw new Error("No tool URL returned from Mastodon");
          }
          console.log(`Toot posted to Mastodon: ${tootUrl}`);
          return tootUrl;
        })
      )
    ),
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

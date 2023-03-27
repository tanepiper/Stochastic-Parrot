#!/usr/bin/env node

import dotenv from "dotenv";
import { createMastodonClient } from "./lib/mastodon.mjs";
import { createOpenAIInstance } from "./lib/openai.mjs";
import { map, tap } from "rxjs/operators";

dotenv.config();

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);

const one = 'Always return a JSON object. The content result as property "body" which is an array of 4 strings no longer than 120 characters. Also always generate a "hashtag" property for the content with hashtags based on the content. Content should be mildly amusing or sarcastic. Don\t mention that it\'s funny or sarcastic'
const two = 'Always return a JSON object. The content result as property "body" which is an array of 5 strings no longer than 120 characters. Also always generate a "hashtag" property for the content with hashtags based on the content. Include a property "introduction" with an intro to the content. Content should be 5 funny non sequitur facts, but don\'t mention they are funny non sequitur facts.'
const three = 'Always return a JSON object. The content result as property "body" which is an array of 3 strings no longer than 120 characters. Also always generate a "hashtag" property for the content with hashtags based on the content. Generate a single house listing, must include a price and location. Content should be mildly amusing or sarcastic. Don\t mention that it\'s funny or sarcastic'
const four = 'Always return a JSON object. The content result as property "body" which is an array of 1 string no longer than 120 characters. Also always generate a "hashtag" property for the content with hashtags based on the content. Generate a humourous motivational quote that sounds like it\'s from a famous motivational speaker or guru. The quote should look original and inspiring, but isn\'t.'
openAI
  .getChat("", {}, `Always return a JSON object. The content result as property "body" which is an array of 5 strings no longer than 120 characters. Also always generate a "hashtag" property for the content with hashtags based on the content. Include a property "introduction" with an intro to the content. Content should be 5 funny non sequitur facts, but don\'t mention they are funny non sequitur facts.`)
  .pipe(tap((result) => console.log(JSON.stringify(result, null, 2))))
  .subscribe();

// const mastodon = createMastodonClient(process.env.MASTODON_ACCESS_TOKEN);

// mastodon.getStatus('110069461965647917').pipe(
//   tap((status) => console.log(status)),
//   map((status) => sanatize(status.content)),
// ).subscribe();

// const filePath = path
//   .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'dall-e')
//   .split(':')[1];

// // const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);
// // const result = await openAI.getChat();
// // console.log(result.data.choices[0].message);

// const paths = await readdir(filePath);
// const files = paths.filter((p) => p.endsWith('.png')).map(f => `${filePath}/${f}`)
// console.log(files);

// files.forEach(async (file) => {
//     const result = await readFile(file);
//     await sharp(result).webp({ quality: 80 }).toFile(file.replace('.png', '.webp'));
// });

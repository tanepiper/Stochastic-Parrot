#!/usr/bin/env node

import dotenv from 'dotenv';
import {createMastodonClient} from './lib/mastodon.mjs';
import {createOpenAIInstance} from './lib/openai.mjs';
import { map, tap } from 'rxjs/operators';

dotenv.config();

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);

openAI.getChat('').pipe(tap((msg) => console.log(msg.choices[0]))).subscribe();

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
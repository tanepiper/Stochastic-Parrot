#!/usr/bin/env node

import dotenv from 'dotenv';
import minimist from 'minimist';
import { tap } from 'rxjs/operators';
import { createOpenAIInstance } from './lib/openai.mjs';

dotenv.config();

const { _, ...opts } = minimist(process.argv.slice(2));
let prompt = _?.[0] ?? '';

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);

openAI
  .getChat(prompt, { max_tokens: 1000, temperature: 0.2 })
  .pipe(
    tap((result) =>
      console.log(
        result?.choices?.[0]?.message?.content ?? ''
      )
    )
  )
  .subscribe();

#!/usr/bin/env node

import dotenv from 'dotenv';
import { tap } from 'rxjs/operators';
import { createOpenAIInstance } from './lib/openai.mjs';

dotenv.config();

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);

openAI
  .getChat('', {}, ``)
  .pipe(tap((result) => console.log(JSON.stringify(result, null, 2))))
  .subscribe();

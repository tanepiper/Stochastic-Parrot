#!/usr/bin/env node

import dotenv from 'dotenv';
import { tap } from 'rxjs/operators';
import { createOpenAIInstance } from './lib/openai.mjs';

dotenv.config();

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);

openAI
  .getChat('', {}, `Always return a JSON object. The content result as property "body" which is an array of 1 string no longer than 120 characters. Also always generate a "hashtag" property for the content with hashtags based on the content. Generate a sarcasticly funny motivational quote that sounds like it's from a famous motivational speaker or guru. The quote should look original and inspiring, but isn't. Don't reveal it's supposed to be sarcastic or funny, but serious.`)
  .pipe(tap((result) => console.log(JSON.stringify(result, null, 2))))
  .subscribe();

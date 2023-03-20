#!/usr/bin/env node

import dotenv from 'dotenv';
import { createOpenAIInstance } from './openai.mjs';

dotenv.config();

const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);


const result = await openAI.getChat();
console.log(result.data.choices[0].message);
#!/usr/bin/env node

import dotenv from 'dotenv';
import { createOpenAIInstance } from './openai.mjs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

dotenv.config();

const filePath = path
  .resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'public', 'dall-e')
  .split(':')[1];

// const openAI = createOpenAIInstance(process.env.OPENAI_API_KEY);
// const result = await openAI.getChat();
// console.log(result.data.choices[0].message);

const paths = await readdir(filePath);
const files = paths.filter((p) => p.endsWith('.png')).map(f => `${filePath}/${f}`)
console.log(files);


files.forEach(async (file) => {
    const result = await readFile(file);
    await sharp(result).webp({ quality: 80 }).toFile(file.replace('.png', '.webp'));
});
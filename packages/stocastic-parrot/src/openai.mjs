import { Configuration, OpenAIApi } from 'openai';
import { writeFile } from 'node:fs/promises';
import { randomNumber } from './lib.mjs';
import path from 'node:path';

const debugMode = process.env.DEBUG_MODE === 'true';

/**
 * Creates an OpenAI Client Instance for the V1 API with optional base path
 * @param {string} apiKey The OpenAI API Key
 * @param {string} base The base path for the API domain to be called
 * @returns {OpenAIApi} OpenAI Client Instance
 */
export function createOpenAIInstance(apiKey, base = '') {
  const configuration = new Configuration({
    apiKey,
    basePath: `https://api.openai.com/v1${base}`,
  });
  return new OpenAIApi(configuration);
}

/**
 *
 * @returns <Promise<string>> Gets an OpenAI completion
 */
export async function getOpenAICompletion(openAI) {
  let completion = '';
  try {
    const response = await openAI.createChatCompletion({
      model: 'gpt-4',
      messages: [{ role: 'user', content: '' }],
      frequency_penalty: 1, //randomNumber(),
      presence_penalty: 1, //randomNumber(),
      temperature: randomNumber(true),
      max_tokens: 200,
    });
    const { content } = response.data.choices[0].message;
    const filePath = path.resolve(`${import.meta.url}`, '..', '..', '..', 'site', 'src', 'entries').split(':')[1];
    console.log(`Saving to ${filePath}/${Date.now()}.json`);
    
    await writeFile(
      `${filePath}/${Date.now()}.json`,
      JSON.stringify(response.data, null, 2),
      { encoding: 'utf8', flag: 'w' }
    );
    completion = content;
  } catch (e) {
    console.log(e);
    console.log('Failed to get completion');
  }
  return completion;
}

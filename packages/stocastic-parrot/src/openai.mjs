import { Configuration, OpenAIApi } from 'openai';
import { from } from 'rxjs';
import { map, retry } from 'rxjs/operators';
import { randomNumber } from './lib.mjs';

const debugMode = process.env.DEBUG_MODE === 'true';

const GPT_MODEL = 'gpt-4'; //'gpt-4';
const MAX_TOKENS = 500; //200;

/**
 * @typedef {object} ChatOptions
 * @property {number} frequency_penalty
 * @property {number} presence_penalty
 * @property {number} temperature
 * @property {number} max_tokens
 * @property {string} model
 */

/**
 * Creates an OpenAI Client Instance for the V1 API with optional base path
 * @param {string} apiKey The OpenAI API Key
 * @param {string} base The base path for the API domain to be called
 */
export function createOpenAIInstance(apiKey) {
  const configuration = new Configuration({
    apiKey,
  });
  const apiInstance = new OpenAIApi(configuration);

  /**
   * Create a chat completion
   * @param {string=} prompt
   * @param {ChatOptions=} options
   * @returns import('rxjs').Observable<CreateChatCompletionResponse>
   */
  function getChat(
    prompt = '',
    options = {
      frequency_penalty: 1,
      presence_penalty: 1,
      temperature: randomNumber(true),
      max_tokens: MAX_TOKENS,
      model: GPT_MODEL,
    }
  ) {
    return from(
      apiInstance.createChatCompletion({
        ...options,
        messages: [{ role: 'user', content: prompt }],
      })
    ).pipe(
      retry({ count: 3, delay: 1000 }),
      map((response) => response.data)
    );
  }

  /**
   * Return an object containing links to images
   * @param {*} prompt
   * @param {*} n
   * @param {*} size
   * @returns
   */
  async function getImages(prompt = ' ', n = 1, size = '1024x1024') {
    return await apiInstance.createImage({
      prompt,
      n,
      size,
    });
  }

  return {
    getChat,
    getImages,
  };
}

import { Configuration, OpenAIApi } from 'openai';
import { from, throwError } from 'rxjs';
import { map, retry, catchError } from 'rxjs/operators';
import { randomNumber } from './lib.mjs';

const debugMode = process.env.DEBUG_MODE === 'true';

const GPT_MODEL = 'gpt-4'; //'gpt-4';
const MAX_TOKENS = 500; //200;

const DEFAULT_CHAT_OPTIONS = {
  frequency_penalty: 1,
  presence_penalty: 1,
  temperature: randomNumber(true),
  max_tokens: MAX_TOKENS,
  model: GPT_MODEL,
};

const DEFAULT_IMAGES_OPTIONS = { n: 1, size: '512x512' };

/**
 * @typedef {object} ChatOptions
 * @property {number} frequency_penalty
 * @property {number} presence_penalty
 * @property {number} temperature
 * @property {number} max_tokens
 * @property {string} model
 */

/**
 * @typedef {object} ImagesOptions
 * @property {number} n
 * @property {number} size
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
   * Takes an optional prompt and returns a response from the OpenAI API chat endpoint. The function provides
   * some sensible defaults for the options object that give a reasonably conversational response, even if no
   * prompt is provided.
   *
   * The return value is an RxJS Observable that can be subscribed to with the data response from the API.
   *
   * @param {string=} prompt Optional prompt to start the conversation
   * @param {ChatOptions=} options Options for the chat endpoint for the quality of the response
   * @returns import('rxjs').Observable<CreateChatCompletionResponse>
   */
  function getChat(prompt = '', options = DEFAULT_CHAT_OPTIONS) {
    return from(
      apiInstance.createChatCompletion({
        ...options,
        messages: [{ role: 'user', content: prompt }],
      })
    ).pipe(
      map((response) => response.data),
      catchError((error) => {
        console.error(`${error.response.status}: ${error.response.statusText}`);
        return throwError(() => error);
      }),
      retry({ count: 3, delay: 1000 }),
    );
  }

  /**
   * Takes an optional prompt and returns a response from the OpenAI API images endpoint. The function provides
   * some default options for the number of images and size of the images.
   *
   * For this API endpoint, the prompt is required but by default is set to a single space character.
   *
   * The return value is an RxJS Observable that can be subscribed to with the data response from the API.
   *
   * @param {string=} prompt Optional prompt to generate an image from
   * @param {ImagesOptions=} options Options for the images endpoint 
   * @returns import('rxjs').Observable<ImageResponse>
   */
  function getImages(prompt = ' ', options = DEFAULT_IMAGES_OPTIONS) {
    return from(
      apiInstance.createImage({
        prompt : prompt ?? ' ', // Sometimes if the prompt is empty it'll cause an error
        ...options,
      })
    ).pipe(
      map((response) => response.data),
      catchError((error) => {
        console.error(`${error.response.status}: ${error.response.statusText}`);
        return throwError(() => error);
      }),
      retry({ count: 3, delay: 1000 }),
    );
  }

  return {
    getChat,
    getImages,
  };
}

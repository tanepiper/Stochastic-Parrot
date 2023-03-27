import { Configuration, OpenAIApi } from 'openai';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';
import { retryConfig, openAIConfig } from '../config.mjs';
import { errorHandlerWithDelay, randomNumber } from './lib.mjs';

/**
 * @typedef {object} ChatOptions Options for passing to the OpenAI Chat endpoint
 * @property {number} temperature The temperature for the chat endpoint
 * @property {number=} frequency_penalty The frequency penalty for the chat endpoint
 * @property {number=} presence_penalty The presence penalty for the chat endpoint
 * @property {number=} max_tokens The max tokens for the chat endpoint
 * @property {string=} model The model for the chat endpoint
 */

/**
 * @typedef {object} ImagesOptions Options for passing to the OpenAI Dall-E endpoint
 * @property {number=} n The number of images to generate
 * @property {number=} size The size of the images to generate
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
  function getChat(prompt = '', options = {}) {
    options = { ...openAIConfig.chat, ...options };
    return from(
      apiInstance.createChatCompletion({
        ...options,
        temperature: options?.temperature ?? randomNumber(true),
        messages: [{ role: 'user', content: prompt }],
      })
    ).pipe(
      map((response) => response.data),
      errorHandlerWithDelay(retryConfig)
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
  function getImages(prompt = ' ', options = {}) {
    options = { ...openAIConfig.dalle, ...options };
    return from(
      apiInstance.createImage({
        prompt: prompt ?? ' ', // Sometimes if the prompt is empty it'll cause an error
        ...options,
      })
    ).pipe(
      map((response) => response.data),
      errorHandlerWithDelay(retryConfig)
    );
  }

  return {
    getChat,
    getImages,
  };
}

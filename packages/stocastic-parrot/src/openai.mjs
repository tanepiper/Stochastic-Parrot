import { Configuration, OpenAIApi } from 'openai';
import { randomNumber } from './lib.mjs';

const debugMode = process.env.DEBUG_MODE === 'true';

const GPT_MODEL = 'gpt-4';

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
   * @returns Promise<CreateChatCompletionResponse>
   */
  async function getChat(prompt = '') {
    return await apiInstance.createChatCompletion({
      model: GPT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      frequency_penalty: 1, //randomNumber(),
      presence_penalty: 1, //randomNumber(),
      temperature: randomNumber(true),
      max_tokens: 200,
    });
  }

  return {
    getChat,
  };
}

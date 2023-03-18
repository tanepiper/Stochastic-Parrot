import { Configuration, OpenAIApi } from 'openai';

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

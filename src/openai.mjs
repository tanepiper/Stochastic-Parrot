import { Configuration, OpenAIApi } from 'openai';

export function createOpenAIInstance(apiKey, base = '') {
  const configuration = new Configuration({
    apiKey,
    basePath: `https://api.openai.com/v1${base}`,
  });
  const openai = new OpenAIApi(configuration);
  return openai;
}

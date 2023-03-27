/**
 * Configuration for http retries
 */
export const retryConfig = {
  count: 10,
  delay: 10000,
};

/**
 * Configuration for the ElevenLabs API
 */
export const elevenLabsConfig = {
  baseUrl: 'https://api.elevenlabs.io/v1',
  voiceId: 'MF3mGyEYCl7XYWbV9V6O',
  voice_settings: {
    stability: 0.2,
    similarity_boost: 0.5,
  },
};

export const openAIConfig = {
  chat: {
    model: 'gpt-4',
    max_tokens: 500,
    frequency_penalty: 1,
    presence_penalty: 1,
  },
  dalle: {
    n: 1,
    size: '512x512',
  },
};

export const AWSS3Config = {
  region: 'eu-west-1',
  credentials: {
    accessKeyId: '',
    secretAccessKey: '',
  },
};

export default {
  retryConfig,
  elevenLabsConfig,
  openAIConfig,
  AWSS3Config
};

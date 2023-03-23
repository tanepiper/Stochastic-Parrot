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
  baseUrl: 'https://api.eleven-labs.com',
  voiceId: 'MF3mGyEYCl7XYWbV9V6O',
  voice_settings: {
    stability: 0.2,
    similarity_boost: 0.5,
  },
};

export default {
  retryConfig,
  elevenLabsConfig,
};

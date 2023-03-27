import axios from 'axios';
import { Client } from 'creatomate';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { retryConfig } from '../config.mjs';
import { errorHandlerWithDelay, streamToFile } from './lib.mjs';

export const videoTemplates = {
  happyVideo: {
    id: 'cb5ed739-810b-45a4-be18-7054e16500a9',
    prompt: `Always return a JSON object. The content result as property "body" which is an array of 4 strings no longer than 120 characters. Also always generate a "hashtag" property for the content with hashtags based on the content. Content should be mildly amusing or sarcastic. Don't mention that it's funny or sarcastic`,
  },
  motivationalQuote: {
    id: 'f3ab36d7-9fef-415c-b966-c81bb587715a',
    prompt: `Always return a JSON object. The content result as property "body" which is an array of 1 string no longer than 120 characters. Also always generate a "hashtag" property for the content with hashtags based on the content. Generate a sarcasticly funny motivational quote that sounds like it's from a famous motivational speaker or guru. The quote should look original and inspiring, but isn't. Don't reveal it's supposed to be sarcastic or funny, but serious.`,
  },
  fiveFacts: {
    id: '3a77d06e-8940-40df-9d3b-3a507dd9265d',
    prompt: `Always return a JSON object. The content result as property "body" which is an array of 5 strings no longer than 120 characters. Also always generate a "hashtag" property for the content with hashtags based on the content. Include a property "introText" with an intro to the content. Content should be 5 funny non sequitur facts, but don't mention they are funny non sequitur facts`,
  },
  realEstate: {
    id: 'a2f062e5-decb-423e-8ee8-85acb51728c8',
    prompt: `Always return a JSON object. The content result as property "body" which is an array of 3 strings no longer than 120 characters. Also always generate a "hashtag" property for the content with hashtags based on the content. Generate a single house listing, must include a price and location. Content should be mildly amusing or sarcastic. Don\t mention that it\'s funny or sarcastic`,
  },
};

/**
 * Create a client for Createomate
 * @param {string} apiKey
 * @returns
 */
export function createCreatomateClient(apiKey) {
  const client = new Client(apiKey);

  /**
   * Generate a video from a template and modifications
   * @param {string} templateId
   * @param {Record<string, string>} modifications
   * @returns
   */
  function generateVideo(templateId, modifications) {
    return from(
      client.render({
        templateId,
        modifications,
      })
    ).pipe(map((r) => r[0]));
  }

  /**
   * Download a video from a URL
   * @param {*} url
   * @param {*} filePath
   * @returns
   */
  function downloadVideo(url, filePath) {
    return from(
      axios(url, {
        method: 'get',
        responseType: 'stream',
      })
    ).pipe(
      switchMap((stream) => streamToFile(stream, filePath)),
      errorHandlerWithDelay(retryConfig)
    );
  }

  return {
    generateVideo,
    downloadVideo,
    videoTemplates,
  };
}

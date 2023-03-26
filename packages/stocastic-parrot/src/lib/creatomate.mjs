import { Client } from 'creatomate';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import axios from 'axios';
import { errorHandlerWithDelay, streamToFile } from './lib.mjs';
import { retryConfig } from '../config.mjs';


export const templates = {
    happyVideo: {
      id: 'cb5ed739-810b-45a4-be18-7054e16500a9',
      prompt: `In the style of short captions for a social media video, Generate a random short story broken down into 4 short sections, each section getting more depressing, give the result as a JSON object with the property 'story' as an array of strings, and a property 'hashtags' which is a string of hashtags that would suit the story. Each string should be max 100 characters.`,
    },
    motivationalQuote: {
      id: 'f3ab36d7-9fef-415c-b966-c81bb587715a',
      prompt: `Create a funny fake motivational quote. Return the result as a JSON object with the property 'story' as an array with one quote, and a property 'hashtags' which is a string of hashtags related to the quote. Each string should be max 200 characters.`,
    },
    fiveFacts: {
      id: '3a77d06e-8940-40df-9d3b-3a507dd9265d',
      prompt: `Give me 5 facts about any topic, for humor make the facts non sequitur to the topic. Return the result as a JSON object with the property 'introText' about the topic starting 'Here are 5 facts about', 'story' as an array with the 5 facts, and a property 'hashtags' which is a string of hashtags related to the topic, these should be serious and not humorous. Each string should be max 200 characters.`,
    },
  };

export function createCreatomateClient(apiKey) {
  const client = new Client(apiKey);

  function generateVideo(templateId, modifications) {
    return from(
      client.render({
        templateId,
        modifications,
      })
    ).pipe(map((r) => r[0]));
  }

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
    templates
  };
}

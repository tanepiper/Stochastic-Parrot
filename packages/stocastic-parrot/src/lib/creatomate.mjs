import { Client } from "creatomate";
import { from } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import axios from "axios";
import { errorHandlerWithDelay, streamToFile } from "./lib.mjs";
import { retryConfig } from "../config.mjs";

export const videoTemplates = {
  happyVideo: {
    id: "cb5ed739-810b-45a4-be18-7054e16500a9",
    prompt: `Craft a short story [about] divided into 4 parts that gradually become more bleak. Output the story as a JSON object with an array of strings under the 'story' property, with each string having a maximum of 100 characters. Include a 'hashtags' property that contains a string of positive and motivational hashtags relevant to the story's theme. Don't prepend any string with "Section"`,
  },
  motivationalQuote: {
    id: "f3ab36d7-9fef-415c-b966-c81bb587715a",
    prompt: `Generate a motivational quote [about] that sounds like it's from a famous motivational speaker or guru. The quote should look original and inspiring, but isn't. Return the result as a JSON object with the 'story' property as an array with one quote, and the 'hashtags' property as a string of hashtags related to the quote. Ensure that each string does not exceed 200 characters.`,
  },
  fiveFacts: {
    id: "3a77d06e-8940-40df-9d3b-3a507dd9265d",
    prompt: `Provide 5 non sequitur facts [about] that are meant to be humorous. Then, return a JSON object with the 'introText' property, which should contain the phrase 'Here are 5 facts about [topic] that you may not know!' The 'story' property should be an array of the 5 non sequitur facts, and the 'hashtags' property should be a string of related hashtags, excluding any humor. Each string should not exceed 200 characters in length.`,
  },
  realEstate: {
    id: "a2f062e5-decb-423e-8ee8-85acb51728c8",
    prompt: `Craft details of a fake house listing with 3 sections and include the price, the listing should include funny facts about the house, then it was built. Output the listing as a JSON object with an array of strings under the 'story' property, with each string having a maximum of 100 characters. Include a 'hashtags' property that contains a string of positive and motivational hashtags relevant to the story's theme. Don't prepend any string with "Section"`,
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
        method: "get",
        responseType: "stream",
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

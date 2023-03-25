import { Client } from 'creatomate';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import axios from 'axios';
import { errorHandlerWithDelay, streamToFile } from './lib.mjs';
import { retryConfig } from '../config.mjs';

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
  };
}

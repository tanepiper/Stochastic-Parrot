import { Client } from 'creatomate';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';

export function createCreatomateClient(apiKey) {
  const client = new Client(apiKey);

  async function generateVideo(templateId, modifications) {
    const result = from(
      client.render({
        templateId,
        modifications,
      })
    ).pipe(map((r) => r[0]));
  }

  return {
    generateVideo,
  };
}

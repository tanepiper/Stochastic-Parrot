import ffmpegStatic from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { map, switchMap } from 'rxjs';

ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 *
 * @returns {import('rxjs').OperatorFunction<string, string>}
 */
export function optimiseVideo(videoFilePath) {
  return (source) =>
    source.pipe(
      switchMap(({ response, jsonBody }) => {
        return new Promise((resolve, reject) => {
          ffmpeg(`${videoFilePath}/${response.id}.mp4`)
            .videoCodec('libx264')
            .audioCodec('libmp3lame')
            .saveToFile(`${videoFilePath}/${response.id}.small.mp4`)
            .on('progress', (progress) => {
              console.log('Processing: ' + progress.frames + 'frames done');
            })
            .on('error', reject)
            .on('end', () => resolve({ response, jsonBody }));
        });
      })
    );
}

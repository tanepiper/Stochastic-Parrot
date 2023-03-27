import AWS from 'aws-sdk';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { readFile } from "node:fs/promises";
import { AWSS3Config } from '../config.mjs';

/**
 * @param {AWS.S3.ClientConfiguration} config
 */
export function createAWSS3Client(config = {}) {

  const client = new AWS.S3({ ...AWSS3Config, ...config });

  /**
   * Uploads a file to S3 and returns the URL of the uploaded file
   * @param {string} source The file source
   * @param {string} bucket The bucket to upload to
   * @param {string} key The key to upload to
   */
  function uploadFile(source, bucket, key) {
    return from(readFile(source)).pipe(
      switchMap((fileData) =>
        client
          .upload({
            Bucket: bucket,
            Key: key,
            Body: fileData,
          })
          .promise()
      ),
      map((result) => result.Location)
    );
  }

  return {
    client,
    uploadFile,
  };
}

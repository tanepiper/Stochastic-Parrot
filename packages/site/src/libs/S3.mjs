import AWS from 'aws-sdk';

const BUCKET_NAME = 'stochastic-parrot';


export function getS3Files(bucket, prefix) {
  const client = new AWS.S3({
    region: 'eu-west-1',
    credentials: {
      accessKeyId: import.meta.env.AWS_ACCESS_KEY,
      secretAccessKey: import.meta.env.AWS_SECRET_KEY,
    },
  });

  return client.listObjectsV2({
    Bucket: bucket,
    Prefix: prefix,
  }).promise();
}
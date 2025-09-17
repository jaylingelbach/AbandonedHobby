import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const requireEnv = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
};

export const AWS_REGION = requireEnv(process.env.AWS_REGION, 'AWS_REGION');
export const S3_BUCKET = requireEnv(process.env.S3_BUCKET, 'S3_BUCKET');
export const S3_PUBLIC_BASE_URL = requireEnv(
  process.env.S3_PUBLIC_BASE_URL,
  'S3_PUBLIC_BASE_URL'
);

export const s3 = new S3Client({
  region: AWS_REGION,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId: requireEnv(process.env.AWS_ACCESS_KEY_ID, 'AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv(
      process.env.AWS_SECRET_ACCESS_KEY,
      'AWS_SECRET_ACCESS_KEY'
    )
  }
});

export type PresignParams = {
  key: string;
  contentType: string;
  expiresSeconds?: number;
};

/**
 * Returns a presigned PUT URL for uploading an object to the configured S3 bucket.
 *
 * @param params - Presign parameters; `expiresSeconds` defaults to 300 seconds.
 * @returns A promise that resolves to a presigned URL which permits an HTTP PUT of the object with the specified `contentType`.
 */
export async function getPresignedPutUrl(
  params: PresignParams
): Promise<string> {
  const { key, contentType, expiresSeconds = 300 } = params;
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType
  });
  return getSignedUrl(s3, command, { expiresIn: expiresSeconds });
}

/**
 * Build a public HTTP URL for an S3 object key using the configured public base.
 *
 * The function trims trailing slashes from the configured S3 public base and leading
 * slashes from `key`, percent-encodes each path segment (preserving path separators),
 * and joins them with a single '/' so duplicate slashes are avoided.
 *
 * @param key - S3 object key or path (may start with `/`); path segments are encoded with `encodeURIComponent`.
 * @returns The fully formed public URL for the given object key.
 */
export function publicUrlForKey(key: string): string {
  const base = S3_PUBLIC_BASE_URL.replace(/\/+$/, '');
  const cleanedKey = key.replace(/^\/+/, '');
  const encodedKey = cleanedKey.split('/').map(encodeURIComponent).join('/');
  return `${base}/${encodedKey}`;
}

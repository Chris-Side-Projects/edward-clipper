// Cloudflare R2 storage configuration
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

export function isBlobConfigured(): boolean {
  return !!(
    process.env.CLOUDFLARE_R2_ENDPOINT &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.EDWARD_CLIPS_BUCKET
  );
}

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!isBlobConfigured()) {
      throw new Error('R2 storage not configured');
    }
    
    s3Client = new S3Client({
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      region: 'auto',
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

export async function putObject(
  key: string,
  body: Buffer | string,
  contentType: string = 'application/octet-stream'
): Promise<void> {
  const client = getS3Client();
  const bucket = process.env.EDWARD_CLIPS_BUCKET!;
  
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getObject(key: string): Promise<Buffer> {
  const client = getS3Client();
  const bucket = process.env.EDWARD_CLIPS_BUCKET!;
  
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  
  if (!response.Body) {
    throw new Error('Object body is empty');
  }
  
  // Convert stream to buffer
  const chunks: Buffer[] = [];
  const stream = response.Body as any;
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
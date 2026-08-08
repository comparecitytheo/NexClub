import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

// Mirrors isAiConfigured(): the app runs fine without storage; upload UI
// stays disabled until these are set. Works with AWS S3, Cloudflare R2,
// MinIO, etc. (set S3_ENDPOINT for non-AWS providers).
export function isStorageConfigured(): boolean {
  return Boolean(
    env.S3_BUCKET && env.S3_REGION && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
  );
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      // Path-style addressing is required by R2/MinIO and harmless on AWS.
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
      },
    });
  }
  return client;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const ALLOWED_IMAGE_TYPES = Object.keys(EXT);
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

// Uploads an avatar and returns the stored object key (saved on User.avatarUrl).
export async function putAvatar(userId: string, body: Buffer, contentType: string): Promise<string> {
  const ext = EXT[contentType] ?? "bin";
  const key = `avatars/${userId}/${randomUUID()}.${ext}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return key;
}

// Uploads a business logo and returns the stored object key (saved on
// User.businessLogoUrl). Same limits and content types as avatars.
export async function putBusinessLogo(userId: string, body: Buffer, contentType: string): Promise<string> {
  const ext = EXT[contentType] ?? "bin";
  const key = `business-logos/${userId}/${randomUUID()}.${ext}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return key;
}

// Presigned GET URL for a stored key. Bucket can stay private.
export async function getAvatarUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

// Best-effort cleanup of the previous avatar.
export async function deleteAvatar(key: string): Promise<void> {
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  } catch {
    // ignore — a missing object is fine.
  }
}

import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

// Mirrors isAiConfigured(): the app runs fine without storage; upload UI
// stays disabled until these are set.
export function isStorageConfigured(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

let configured = false;
function cloudinaryClient() {
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

// One asset per user per folder: `public_id` is the user id and `overwrite` is
// on, so re-uploading replaces the previous image in place rather than leaving
// an orphan behind. `invalidate` clears the CDN copy of the old bytes.
function upload(folder: string, userId: string, body: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinaryClient().uploader.upload_stream(
      { folder, public_id: userId, overwrite: true, invalidate: true, resource_type: "image" },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Cloudinary upload failed."));
        resolve(result.secure_url);
      }
    );
    stream.end(body);
  });
}

// Uploads an avatar and returns its public URL (saved on User.avatarUrl).
// `contentType` is accepted so callers keep a single call shape; Cloudinary
// detects the format itself, and the route has already validated it.
export async function putAvatar(userId: string, body: Buffer, _contentType?: string): Promise<string> {
  return upload("avatars", userId, body);
}

// Uploads a business logo and returns its public URL (saved on
// User.businessLogoUrl). Same limits and content types as avatars.
export async function putBusinessLogo(userId: string, body: Buffer, _contentType?: string): Promise<string> {
  return upload("business-logos", userId, body);
}

/**
 * What we store IS the URL.
 *
 * The S3 implementation this replaced stored an object key and signed a
 * short-lived GET on read. Cloudinary hands back a permanent public URL at
 * upload time, so there is nothing to sign — the stored value is returned as
 * it is. Kept async, and kept on the read path, so the routes calling it do
 * not have to care which backend is behind them.
 */
export async function publicImageUrl(stored: string): Promise<string> {
  return stored;
}

// Best-effort cleanup of a user's avatar. Keyed by user, not by URL: the
// public_id is the user id, and a stored URL carries a version segment that
// cannot be turned back into one reliably.
export async function deleteAvatar(userId: string): Promise<void> {
  try {
    await cloudinaryClient().uploader.destroy(`avatars/${userId}`, { resource_type: "image" });
  } catch {
    // ignore — a missing object is fine.
  }
}

// Best-effort cleanup of a user's business logo. Separate from deleteAvatar:
// they are different folders, so deleting one must never touch the other.
export async function deleteBusinessLogo(userId: string): Promise<void> {
  try {
    await cloudinaryClient().uploader.destroy(`business-logos/${userId}`, { resource_type: "image" });
  } catch {
    // ignore — a missing object is fine.
  }
}

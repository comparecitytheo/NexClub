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
export async function putAvatar(userId: string, body: Buffer): Promise<string> {
  return upload("avatars", userId, body);
}

// Uploads a business logo and returns its public URL (saved on
// User.businessLogoUrl). Same limits and content types as avatars.
export async function putBusinessLogo(userId: string, body: Buffer): Promise<string> {
  return upload("business-logos", userId, body);
}

// Best-effort cleanup of a user's avatar.
export async function deleteAvatar(userId: string): Promise<void> {
  try {
    await cloudinaryClient().uploader.destroy(`avatars/${userId}`, { resource_type: "image" });
  } catch {
    // ignore — a missing object is fine.
  }
}

// Best-effort cleanup of a user's business logo.
export async function deleteBusinessLogo(userId: string): Promise<void> {
  try {
    await cloudinaryClient().uploader.destroy(`business-logos/${userId}`, { resource_type: "image" });
  } catch {
    // ignore — a missing object is fine.
  }
}

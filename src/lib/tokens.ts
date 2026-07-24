import crypto from "crypto";

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Only the hash is stored, so a leaked DB row can't be used to reset passwords.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Constant-time comparison of two hex-encoded hashes. Tokens are always looked up
// by their stored hash (never by the raw token), and this adds a timing-safe
// re-check at the boundary so token verification can't leak via response timing.
export function tokenHashEquals(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}


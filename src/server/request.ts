import { timingSafeEqual } from "crypto";

// Best-effort client IP + user agent for audit records. On Vercel/most proxies
// the real client IP is the first entry of x-forwarded-for.
export function getClientContext(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0]?.trim() : "") || h.get("x-real-ip") || null;
  return { ipAddress: ip || null, userAgent: h.get("user-agent") };
}

/**
 * Constant-time check of a `Bearer <secret>` authorization header.
 *
 * The cron endpoints used `!==`, which short-circuits on the first differing
 * byte and so leaks the length of the matching prefix through response timing.
 * The practical risk over HTTP is small, but these are public URLs and the
 * secret is the only thing standing between an attacker and an endpoint that
 * can email the whole club, so it is worth doing properly.
 *
 * timingSafeEqual throws on length mismatch, hence the explicit length check —
 * which is itself fine to leak, since the secret's length is not the secret.
 */
export function bearerMatches(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

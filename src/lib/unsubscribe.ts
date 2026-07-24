import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// Unforgeable, session-free unsubscribe links for notification emails.
//
// The Spam Act expects unsubscribing to work without undue effort, so the link
// cannot require signing in — the reader may be on a phone, logged out. A token
// derived from the user id and AUTH_SECRET makes the link unguessable while
// needing no session. It only ever turns notifications OFF, so a leaked link
// cannot be used to enable anything or to read data.

export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`unsubscribe:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

export function unsubscribeTokenMatches(userId: string, provided: string): boolean {
  const expected = unsubscribeToken(userId);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  // Length is checked first because timingSafeEqual throws on a length mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

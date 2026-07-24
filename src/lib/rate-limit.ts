// Best-effort in-memory fixed-window rate limiter. Good for a single instance and
// for development. On serverless (multiple instances) each instance keeps its own
// counters, so for hard multi-instance guarantees back this with a shared store
// (e.g. Upstash Redis) behind the same rateLimit() signature.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

// Drop expired buckets so the map can't grow unbounded over a long-lived process.
export function purgeExpired(now: number = Date.now()): void {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

// Test-only: clear all counters between cases.
export function __resetRateLimiter(): void {
  buckets.clear();
}

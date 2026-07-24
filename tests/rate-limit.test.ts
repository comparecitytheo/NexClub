import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, __resetRateLimiter } from "@/lib/rate-limit";

beforeEach(() => __resetRateLimiter());

describe("rate limiter", () => {
  it("allows requests up to the limit, then blocks with a retry hint", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 60_000).ok).toBe(true);
    const blocked = rateLimit("k", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks each key independently", () => {
    expect(rateLimit("a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("a", 1, 60_000).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000).ok).toBe(true);
  });

  it("resets after the window elapses", () => {
    expect(rateLimit("w", 1, 1).ok).toBe(true);
    expect(rateLimit("w", 1, 1).ok).toBe(false);
    const t = Date.now();
    while (Date.now() <= t + 2) { /* let the 1ms window pass */ }
    expect(rateLimit("w", 1, 1).ok).toBe(true);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, __resetRateLimiter } from "@/lib/rate-limit";

beforeEach(() => __resetRateLimiter());
// Restore the real clock so a fake-timer case can't leak into later files.
afterEach(() => vi.useRealTimers());

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

  // Fake timers, not a 1ms window and a busy-wait: with a real clock the two
  // calls below can straddle a 1ms window, the limiter correctly allows the
  // second one, and the test fails for a reason that isn't a bug.
  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    expect(rateLimit("w", 1, 60_000).ok).toBe(true);
    expect(rateLimit("w", 1, 60_000).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rateLimit("w", 1, 60_000).ok).toBe(true);
  });
});

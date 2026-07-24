import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, __resetRateLimiter } from "@/lib/rate-limit";
import { AUDIT_ACTION_LABELS } from "@/lib/notifications";

// Bulk CSV export discloses a whole book of personal information in one click.
// It is scoped (non-admins only ever see their own rows), but it must also be
// throttled and recorded — these tests pin the throttle and the audit labelling.

beforeEach(() => {
  __resetRateLimiter();
});

describe("export throttling", () => {
  const LIMIT = 5;
  const WINDOW = 5 * 60_000;

  it("allows a normal number of exports", () => {
    for (let i = 0; i < LIMIT; i++) {
      expect(rateLimit("export-leads:user-1", LIMIT, WINDOW).ok).toBe(true);
    }
  });

  it("blocks a scripted bulk-download loop once the limit is hit", () => {
    for (let i = 0; i < LIMIT; i++) rateLimit("export-leads:user-1", LIMIT, WINDOW);
    const blocked = rateLimit("export-leads:user-1", LIMIT, WINDOW);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("throttles per user, so one member cannot lock out another", () => {
    for (let i = 0; i < LIMIT; i++) rateLimit("export-leads:user-1", LIMIT, WINDOW);
    expect(rateLimit("export-leads:user-1", LIMIT, WINDOW).ok).toBe(false);
    expect(rateLimit("export-leads:user-2", LIMIT, WINDOW).ok).toBe(true);
  });

  it("throttles leads and contacts exports independently", () => {
    for (let i = 0; i < LIMIT; i++) rateLimit("export-leads:user-1", LIMIT, WINDOW);
    expect(rateLimit("export-leads:user-1", LIMIT, WINDOW).ok).toBe(false);
    expect(rateLimit("export-contacts:user-1", LIMIT, WINDOW).ok).toBe(true);
  });
});

describe("EXPORT audit action", () => {
  it("has a human-readable label so exports are legible in the audit view", () => {
    expect(AUDIT_ACTION_LABELS).toHaveProperty("EXPORT");
    expect(AUDIT_ACTION_LABELS.EXPORT).toBeTruthy();
  });
});

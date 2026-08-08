import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, __resetRateLimiter } from "@/lib/rate-limit";
import { AUDIT_ACTION_LABELS } from "@/lib/notifications";
import { isAdmin, isSuperAdmin } from "@/lib/rbac";

// Bulk CSV export discloses a whole book of personal information in one click.
// It is restricted to Super Admins (admins and members get a 403), but it must also be
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

describe("who may export", () => {
  // Bulk CSV export is Super Admin only. Regular members and ADMINs must not be
  // able to download lead or contact details, even by calling the endpoint
  // directly — the UI button is hidden, but the server is what enforces it.
  it("permits only SUPER_ADMIN", () => {
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
    expect(isSuperAdmin("ADMIN")).toBe(false);
    expect(isSuperAdmin("MANAGER")).toBe(false);
    // SALES_REP is this schema's ordinary member role — there is no MEMBER.
    expect(isSuperAdmin("SALES_REP")).toBe(false);
  });

  it("does not fall back to the broader admin check", () => {
    // An ADMIN passes isAdmin but must still fail the export gate.
    expect(isAdmin("ADMIN")).toBe(true);
    expect(isSuperAdmin("ADMIN")).toBe(false);
  });
});

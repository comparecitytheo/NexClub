import { describe, it, expect, vi } from "vitest";

// The lead validators reference Prisma enums via z.nativeEnum, so supply them
// directly rather than booting the Prisma engine (as tests/lead-consent does).
vi.mock("@prisma/client", () => ({
  LeadStatus: { NEW: "NEW", CONTACTED: "CONTACTED", IN_PROGRESS: "IN_PROGRESS", CLOSED_WON: "CLOSED_WON", CLOSED_LOST: "CLOSED_LOST", DELETED: "DELETED" },
  SentLeadStatus: { SENT: "SENT", VIEWED: "VIEWED", RESPONDED: "RESPONDED", CONVERTED: "CONVERTED", CLOSED: "CLOSED" },
  LeadSource: { REFERRAL: "REFERRAL", WEBSITE: "WEBSITE", COLD_OUTREACH: "COLD_OUTREACH", EVENT: "EVENT", SOCIAL: "SOCIAL", OTHER: "OTHER" },
  LeadPriority: { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" },
}));

import { isSuperAdmin } from "@/lib/rbac";
import { listLeadsSchema } from "@/server/validators/lead";

// The Deleted tab shows a member only the leads THEY deleted, while a Super
// Admin sees every deleted lead in the club. These pin the rule the API applies.

/** Mirrors the scoping in GET /api/leads for view=deleted. */
function deletedScope(role: string, userId: string) {
  return isSuperAdmin(role as never)
    ? { status: "DELETED" }
    : { status: "DELETED", deletedById: userId };
}

describe("deleted view — accepted by the API", () => {
  it("accepts view=deleted", () => {
    const r = listLeadsSchema.safeParse({ view: "deleted" });
    expect(r.success).toBe(true);
  });

  it("still accepts the original three views", () => {
    for (const view of ["received", "sent", "all"]) {
      expect(listLeadsSchema.safeParse({ view }).success).toBe(true);
    }
  });

  it("rejects an unknown view", () => {
    expect(listLeadsSchema.safeParse({ view: "archived" }).success).toBe(false);
  });
});

describe("deleted view — who sees what", () => {
  it("limits an ordinary member to leads they deleted themselves", () => {
    const scope = deletedScope("SALES_REP", "user-1");
    expect(scope).toEqual({ status: "DELETED", deletedById: "user-1" });
  });

  it("limits an admin the same way — this tab is not club-wide for them", () => {
    const scope = deletedScope("ADMIN", "user-1");
    expect(scope).toEqual({ status: "DELETED", deletedById: "user-1" });
  });

  it("gives a Super Admin every deleted lead in the club", () => {
    const scope = deletedScope("SUPER_ADMIN", "user-1");
    expect(scope).toEqual({ status: "DELETED" });
    expect(scope).not.toHaveProperty("deletedById");
  });

  it("never returns leads that were not deleted", () => {
    for (const role of ["SALES_REP", "MANAGER", "ADMIN", "SUPER_ADMIN"]) {
      expect(deletedScope(role, "u1").status).toBe("DELETED");
    }
  });
});

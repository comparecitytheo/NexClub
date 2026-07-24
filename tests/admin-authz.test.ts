import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserRole } from "@prisma/client";
import { wouldRemoveLastSuperAdmin } from "@/server/admin/roles";

// Mock the auth module BEFORE importing api-helpers, so the guard under test does
// not pull in the real Auth.js/Prisma/bcrypt chain (which can't load in this env).
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { requireSuperAdmin } from "@/server/api-helpers";

// Every non-super-admin role. Each /api/admin/* route delegates to requireSuperAdmin,
// so proving the guard rejects these proves every admin endpoint rejects them.
const NON_SUPER: UserRole[] = ["ADMIN", "MANAGER", "SALES_REP", "SUPPORT_AGENT"];

describe("wouldRemoveLastSuperAdmin (last-super-admin protection)", () => {
  it("blocks demoting the only Super Admin (this is the self-demotion case)", () => {
    expect(wouldRemoveLastSuperAdmin({ targetCurrentRole: "SUPER_ADMIN", newRole: "ADMIN", superAdminCount: 1 })).toBe(true);
  });

  it("allows demotion when another Super Admin exists", () => {
    expect(wouldRemoveLastSuperAdmin({ targetCurrentRole: "SUPER_ADMIN", newRole: "ADMIN", superAdminCount: 2 })).toBe(false);
  });

  it("allows keeping the Super Admin role (no demotion)", () => {
    expect(wouldRemoveLastSuperAdmin({ targetCurrentRole: "SUPER_ADMIN", newRole: "SUPER_ADMIN", superAdminCount: 1 })).toBe(false);
  });

  it("ignores role changes for non-super-admins", () => {
    expect(wouldRemoveLastSuperAdmin({ targetCurrentRole: "ADMIN", newRole: "SALES_REP", superAdminCount: 1 })).toBe(false);
  });
});

describe("requireSuperAdmin (guard on every /api/admin/* endpoint)", () => {
  beforeEach(() => authMock.mockReset());

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const r = await requireSuperAdmin();
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error!.status).toBe(401);
  });

  it.each(NON_SUPER)("returns 403 for role %s", async (role) => {
    authMock.mockResolvedValue({ user: { id: "u1", role, organizationId: "o1" } });
    const r = await requireSuperAdmin();
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error!.status).toBe(403);
  });

  it("passes a SUPER_ADMIN through", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "SUPER_ADMIN", organizationId: "o1" } });
    const r = await requireSuperAdmin();
    expect("error" in r).toBe(false);
    if (!("error" in r)) expect((r.user as { role: string }).role).toBe("SUPER_ADMIN");
  });
});

import { describe, it, expect } from "vitest";
import {
  isAdmin,
  isManager,
  atLeast,
  tierOf,
  assignableTiers,
  canManageRole,
} from "@/lib/rbac";

describe("rbac", () => {
  it("treats ADMIN and SUPER_ADMIN as admins", () => {
    expect(isAdmin("ADMIN")).toBe(true);
    expect(isAdmin("SUPER_ADMIN")).toBe(true);
    expect(isAdmin("MANAGER")).toBe(false);
    expect(isAdmin("SALES_REP")).toBe(false);
  });
  it("treats MANAGER and above as managers", () => {
    expect(isManager("MANAGER")).toBe(true);
    expect(isManager("ADMIN")).toBe(true);
    expect(isManager("SALES_REP")).toBe(false);
  });
  it("ranks roles with atLeast", () => {
    expect(atLeast("ADMIN", "MANAGER")).toBe(true);
    expect(atLeast("SALES_REP", "ADMIN")).toBe(false);
    expect(atLeast("MANAGER", "MANAGER")).toBe(true);
  });
});

describe("three-tier mapping", () => {
  it("collapses the five enum roles onto three tiers", () => {
    expect(tierOf("SUPER_ADMIN")).toBe("SUPER_ADMIN");
    expect(tierOf("ADMIN")).toBe("ADMIN");
    expect(tierOf("MANAGER")).toBe("EMPLOYEE");
    expect(tierOf("SALES_REP")).toBe("EMPLOYEE");
    expect(tierOf("SUPPORT_AGENT")).toBe("EMPLOYEE");
  });
});

describe("role-assignment permissions", () => {
  it("lets a Super Admin assign every tier, including Admin", () => {
    expect(assignableTiers("SUPER_ADMIN")).toEqual(["SUPER_ADMIN", "ADMIN", "EMPLOYEE"]);
  });
  it("lets an Admin assign only Admin and Employee", () => {
    expect(assignableTiers("ADMIN")).toEqual(["ADMIN", "EMPLOYEE"]);
  });
  it("lets an Employee assign nothing", () => {
    expect(assignableTiers("SALES_REP")).toEqual([]);
    expect(assignableTiers("MANAGER")).toEqual([]);
    expect(assignableTiers("SUPPORT_AGENT")).toEqual([]);
  });

  it("Super Admin can manage every tier", () => {
    for (const r of ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_REP", "SUPPORT_AGENT"] as const) {
      expect(canManageRole("SUPER_ADMIN", r)).toBe(true);
    }
  });
  it("Admin can manage Admin + Employees but NOT Super Admin (no escalation)", () => {
    expect(canManageRole("ADMIN", "ADMIN")).toBe(true);
    expect(canManageRole("ADMIN", "MANAGER")).toBe(true);
    expect(canManageRole("ADMIN", "SALES_REP")).toBe(true);
    // The escalation guard: an Admin can never create or touch a Super Admin,
    // which also blocks self-promotion via PATCH /api/users/[id].
    expect(canManageRole("ADMIN", "SUPER_ADMIN")).toBe(false);
  });
  it("Employees cannot manage anyone", () => {
    for (const r of ["SUPER_ADMIN", "ADMIN", "SALES_REP"] as const) {
      expect(canManageRole("SALES_REP", r)).toBe(false);
    }
  });
});

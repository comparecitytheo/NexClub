import { describe, it, expect } from "vitest";
import { invitedRoleFor, resolveInviteScope } from "@/lib/rbac";

const ALL_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_REP", "SUPPORT_AGENT"] as const;

describe("invite role + scope (enforced at the API)", () => {
  it("a super admin invites a business admin (ADMIN), never a super admin", () => {
    expect(invitedRoleFor("SUPER_ADMIN")).toBe("ADMIN");
  });

  it("a business admin invites a standard member (SALES_REP)", () => {
    expect(invitedRoleFor("ADMIN")).toBe("SALES_REP");
  });

  it("never yields SUPER_ADMIN for any caller", () => {
    for (const r of ALL_ROLES) expect(invitedRoleFor(r)).not.toBe("SUPER_ADMIN");
  });

  it("super admin scope: role ADMIN + the business they named (trimmed)", () => {
    const s = resolveInviteScope({
      callerRole: "SUPER_ADMIN",
      callerBusinessName: null,
      submittedBusinessName: "  New Biz  ",
    });
    expect(s.role).toBe("ADMIN");
    expect(s.businessName).toBe("New Biz");
  });

  it("business admin scope: role SALES_REP, forced to their OWN business (submitted ignored)", () => {
    const s = resolveInviteScope({
      callerRole: "ADMIN",
      callerBusinessName: "Admin's Firm",
      submittedBusinessName: "Someone Else's Co",
    });
    expect(s.role).toBe("SALES_REP");
    // A business admin cannot invite into another business.
    expect(s.businessName).toBe("Admin's Firm");
  });

  it("resolveInviteScope never returns SUPER_ADMIN", () => {
    for (const r of ALL_ROLES) {
      const s = resolveInviteScope({ callerRole: r, callerBusinessName: "X", submittedBusinessName: "Y" });
      expect(s.role).not.toBe("SUPER_ADMIN");
    }
  });
});

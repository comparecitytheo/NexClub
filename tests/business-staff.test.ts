import { describe, it, expect } from "vitest";
import { resolveInviteScope, invitedRoleFor, tierOf } from "@/lib/rbac";

describe("an admin adding staff to their own business", () => {
  it("forces the invite onto the ADMIN'S business, ignoring whatever was submitted", () => {
    // The business name is not trusted from the client: an admin cannot add a
    // person to a business they do not belong to, however the request is formed.
    const scope = resolveInviteScope({
      callerRole: "ADMIN",
      callerBusinessName: "Sharma Financial",
      submittedBusinessName: "Someone Else Pty Ltd",
    });
    expect(scope.businessName).toBe("Sharma Financial");
  });

  it("gives the new person the staff role, not admin", () => {
    const scope = resolveInviteScope({
      callerRole: "ADMIN",
      callerBusinessName: "Sharma Financial",
      submittedBusinessName: "Sharma Financial",
    });
    expect(scope.role).toBe("SALES_REP");
    expect(tierOf(scope.role)).toBe("EMPLOYEE");
  });

  it("cannot be used to create another admin", () => {
    expect(invitedRoleFor("ADMIN")).toBe("SALES_REP");
    expect(invitedRoleFor("MANAGER")).toBe("SALES_REP");
    expect(invitedRoleFor("SALES_REP")).toBe("SALES_REP");
  });
});

describe("a super admin setting up a business", () => {
  it("may name any business, and creates its director", () => {
    const scope = resolveInviteScope({
      callerRole: "SUPER_ADMIN",
      callerBusinessName: "NEX Club",
      submittedBusinessName: "Brand New Business",
    });
    expect(scope.businessName).toBe("Brand New Business");
    expect(scope.role).toBe("ADMIN");
  });

  it("never mints another super admin", () => {
    expect(resolveInviteScope({
      callerRole: "SUPER_ADMIN",
      callerBusinessName: "NEX Club",
      submittedBusinessName: "X",
    }).role).not.toBe("SUPER_ADMIN");
  });
});

describe("how staff are grouped on the directory card", () => {
  it("separates directors from staff", () => {
    expect(tierOf("ADMIN")).toBe("ADMIN");
    expect(tierOf("SUPER_ADMIN")).toBe("SUPER_ADMIN");
    for (const role of ["SALES_REP", "SUPPORT_AGENT", "MANAGER"] as const) {
      expect(tierOf(role)).toBe("EMPLOYEE");
    }
  });
});

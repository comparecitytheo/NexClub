import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTE = readFileSync(join(process.cwd(), "src/app/api/admin/users/[id]/route.ts"), "utf8");
const PROFILE = readFileSync(join(process.cwd(), "src/server/validators/profile.ts"), "utf8");
const UI = readFileSync(join(process.cwd(), "src/components/admin/admin-user-detail.tsx"), "utf8");

/**
 * A Super Admin can fix a member's listing on their behalf.
 *
 * The fields are deliberately the SAME ones the member can edit themselves,
 * plus name — which members can no longer change. Anything with its own guard
 * (role, active status, business) keeps its own endpoint.
 */
describe("the editable fields match the member's own", () => {
  it("covers every field a member edits themselves", () => {
    for (const field of ["industry", "services", "phone", "bio"]) {
      expect(PROFILE).toMatch(new RegExp(`${field}: optionalText`));
      expect(ROUTE).toMatch(new RegExp(`${field}: z\\.string\\(\\)`));
    }
  });

  it("adds name, which the member can no longer change", () => {
    expect(ROUTE).toMatch(/name: z\.string\(\)\.trim\(\)\.min\(2/);
    expect(PROFILE).toMatch(/`name` is deliberately ABSENT|name` is deliberately ABSENT/);
  });
});

describe("it does not route around the other guards", () => {
  it("cannot set role, active status or business membership", () => {
    const schema = ROUTE.slice(ROUTE.indexOf("adminEditProfileSchema"), ROUTE.indexOf("});", ROUTE.indexOf("adminEditProfileSchema")));
    for (const field of ["role", "isActive", "businessId", "businessName"]) {
      expect(schema).not.toMatch(new RegExp(`\\b${field}\\b`));
    }
  });

  it("leaves the last-admin guard on its own endpoints", () => {
    // Promoting/demoting still goes through /role, which checks it.
    expect(ROUTE).toMatch(/lastAdminBlocker/);
  });
});

describe("partial updates do not blank other fields", () => {
  it("writes only the keys that were sent", () => {
    expect(ROUTE).toMatch(/if \(value === undefined\) continue;/);
  });

  it("treats empty string as a deliberate clear", () => {
    expect(ROUTE).toMatch(/value === "" \? null : String\(value\)/);
  });

  it("rejects a request that changes nothing", () => {
    expect(ROUTE).toMatch(/Nothing to update\./);
  });
});

describe("the edit is silent to the member, so the audit carries the weight", () => {
  it("records the real before and after, not just the name", () => {
    expect(ROUTE).toMatch(/before: Object\.fromEntries/);
    expect(ROUTE).toMatch(/after: data,/);
  });

  it("is Super Admin only and blocked during support mode", () => {
    expect(ROUTE).toMatch(/requireSuperAdminForWrite\(\)/);
  });

  it("tells the operator the change is logged", () => {
    expect(UI).toMatch(/recorded in the audit log against your account/);
  });
});

describe("the form seeds from the current profile", () => {
  it("fills every field, so an untouched one is not blanked", () => {
    for (const f of ["industry", "services", "phone", "bio"]) {
      expect(UI).toMatch(new RegExp(`${f}: profile\\.${f} \\?\\? ""`));
    }
  });
});

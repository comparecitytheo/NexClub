import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTE = readFileSync(
  join(process.cwd(), "src/app/api/admin/businesses/[id]/route.ts"),
  "utf8"
);

/**
 * Renaming a business is the case that makes the display mirror dangerous:
 * User.businessName is a copy of Business.name, so a rename must update both or
 * members show the old name while the directory shows the new one.
 *
 * These are structural assertions on the route. The failure they guard against
 * is a future edit dropping the mirror update or the transaction — neither of
 * which a happy-path test would notice, because the rename itself would still
 * appear to work.
 */
describe("renaming a business keeps the display mirror in step", () => {
  it("updates the business row", () => {
    expect(ROUTE).toMatch(/prisma\.business\.update\(/);
  });

  it("also updates every member's copy of the name", () => {
    expect(ROUTE).toMatch(/prisma\.user\.updateMany\(\s*\{\s*where:\s*\{\s*businessId:/);
    expect(ROUTE).toMatch(/data:\s*\{\s*businessName:\s*name\s*\}/);
  });

  it("does both in ONE transaction, so a rename cannot land half-applied", () => {
    expect(ROUTE).toMatch(/prisma\.\$transaction\(\[/);
    const tx = ROUTE.slice(ROUTE.indexOf("$transaction"));
    expect(tx).toMatch(/business\.update/);
    expect(tx).toMatch(/user\.updateMany/);
  });
});

describe("renaming is guarded", () => {
  it("is Super Admin only, and blocked during support mode", () => {
    expect(ROUTE).toMatch(/requireSuperAdminForWrite\(\)/);
  });

  it("refuses a name another business already uses", () => {
    // Two identically named businesses would render as duplicate directory cards.
    expect(ROUTE).toMatch(/mode:\s*"insensitive"/);
    expect(ROUTE).toMatch(/status:\s*409/);
  });

  it("scopes the lookup to the caller's organisation", () => {
    expect(ROUTE).toMatch(/organizationId:\s*user\.organizationId/);
  });

  it("records the old and new name in the audit log", () => {
    expect(ROUTE).toMatch(/before:\s*\{\s*name:\s*existing\.name\s*\}/);
    expect(ROUTE).toMatch(/after:\s*\{\s*name\s*\}/);
  });
});

describe("renaming a member", () => {
  const USER_ROUTE = readFileSync(
    join(process.cwd(), "src/app/api/admin/users/[id]/route.ts"),
    "utf8"
  );

  it("is Super Admin only and write-guarded", () => {
    expect(USER_ROUTE).toMatch(/export async function PATCH/);
    expect(USER_ROUTE).toMatch(/requireSuperAdminForWrite\(\)/);
  });

  it("cannot reach a member in another organisation", () => {
    const patch = USER_ROUTE.slice(USER_ROUTE.indexOf("export async function PATCH"));
    expect(patch).toMatch(/organizationId:\s*user\.organizationId/);
  });

  it("audits the change", () => {
    const patch = USER_ROUTE.slice(USER_ROUTE.indexOf("export async function PATCH"));
    expect(patch).toMatch(/recordAudit/);
  });
});

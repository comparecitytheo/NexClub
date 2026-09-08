import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: mocks.count },
    business: { findUnique: mocks.findUnique },
  },
}));

import { businessIfNowEmpty } from "@/server/businesses";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const COLLECTION = read("src/app/api/admin/businesses/route.ts");
const SINGLE = read("src/app/api/admin/businesses/[id]/route.ts");
const MEMBER_DELETE = read("src/app/api/users/[id]/route.ts");
const ADMIN_DELETE = read("src/app/api/admin/users/[id]/route.ts");
const TABLE = read("src/components/members/members-table.tsx");

beforeEach(() => {
  mocks.count.mockReset();
  mocks.findUnique.mockReset();
});

/**
 * A business used to exist only as a side effect of someone naming it, and
 * nothing could remove one. The club asked for direct control of both.
 */
describe("creating a business", () => {
  it("matches existing names case-insensitively", () => {
    // resolveBusiness matches that way, so allowing "Acme" beside "ACME" would
    // mean the next member typing either joins an arbitrary one of the two.
    expect(COLLECTION).toMatch(/name: \{ equals: name, mode: "insensitive" \}/);
    expect(COLLECTION).toMatch(/already exists/);
  });

  it("is Super Admin only", () => {
    expect(COLLECTION).toMatch(/requireSuperAdminForWrite/);
  });

  it("records an audit entry", () => {
    expect(COLLECTION).toMatch(/action: "CREATE",\s*entityType: "Business"/);
  });
});

describe("deleting a business", () => {
  it("detaches members instead of deleting them", () => {
    expect(SINGLE).toMatch(/prisma\.user\.updateMany/);
    expect(SINGLE).not.toMatch(/user\.delete|user\.deleteMany|user\.softDelete/);
  });

  /**
   * The one that matters. `User.businessName` is a display mirror and the
   * Member Directory groups people by it. The foreign key alone is
   * onDelete: SetNull, so clearing only `businessId` would leave the deleted
   * business still listed in the directory with its members under it.
   */
  it("clears the display mirror as well as the foreign key", () => {
    expect(SINGLE).toMatch(/data: \{ businessId: null, businessName: null \}/);
  });

  it("detaches and deletes in one transaction", () => {
    expect(SINGLE).toMatch(/prisma\.\$transaction\(\[[\s\S]*?business\.delete/);
  });

  it("refuses without explicit confirmation", () => {
    expect(SINGLE).toMatch(/searchParams\.get\("confirm"\) !== "true"/);
    expect(SINGLE).toMatch(/Confirmation required/);
  });

  it("is Super Admin only", () => {
    expect(SINGLE).toMatch(/export async function DELETE[\s\S]{0,200}requireSuperAdminForWrite/);
  });
});

describe("businessIfNowEmpty", () => {
  it("returns the business when the last member has gone", async () => {
    mocks.count.mockResolvedValue(0);
    mocks.findUnique.mockResolvedValue({ id: "b1", name: "Shire Plumbing" });
    await expect(businessIfNowEmpty("b1")).resolves.toEqual({ id: "b1", name: "Shire Plumbing" });
  });

  it("returns null while anyone is still there", async () => {
    mocks.count.mockResolvedValue(1);
    await expect(businessIfNowEmpty("b1")).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for a member who belonged to no business", async () => {
    await expect(businessIfNowEmpty(null)).resolves.toBeNull();
    expect(mocks.count).not.toHaveBeenCalled();
  });
});

describe("removing the last member offers to delete the business", () => {
  it("both delete routes report the emptied business", () => {
    expect(MEMBER_DELETE).toMatch(/businessIfNowEmpty\(target\.businessId\)/);
    expect(ADMIN_DELETE).toMatch(/businessIfNowEmpty\(target\.businessId\)/);
    expect(MEMBER_DELETE).toMatch(/orphanedBusiness/);
    expect(ADMIN_DELETE).toMatch(/orphanedBusiness/);
  });

  it("asks rather than deleting the business automatically", () => {
    // The business carries its own chapter and address; removing a person must
    // not silently destroy them.
    expect(TABLE).toMatch(/orphanedBusiness/);
    expect(TABLE).toMatch(/confirm\(/);
    expect(TABLE).toMatch(/businesses\/\$\{orphaned\.id\}\?confirm=true/);
  });
});

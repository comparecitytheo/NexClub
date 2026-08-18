import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * ROLE × SCOPE × TAB matrix for lead visibility.
 *
 * These exercise leadAccessWhere directly — the single place every lead read is
 * scoped — against fixture data with TWO businesses in one club.
 */
const db = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: db } }));

import { leadAccessWhere, colleagueIdsFor } from "@/server/businesses";

// Club with two businesses.
const WEBB = { id: "biz-webb", members: ["webb-admin", "webb-staff"] };
const COLE = { id: "biz-cole", members: ["cole-admin"] };
const SUPER = { id: "biz-super", members: ["super-admin"] };

function asMemberOf(biz: { id: string; members: string[] }) {
  db.findUnique.mockResolvedValue({ businessId: biz.id });
  db.findMany.mockResolvedValue(biz.members.map((id) => ({ id })));
}

beforeEach(() => {
  db.findUnique.mockReset();
  db.findMany.mockReset();
});

/** Every user id the filter would admit, flattened out of the where fragment. */
function admitted(where: Record<string, unknown>): string[] | "ALL" {
  if (Object.keys(where).length === 0) return "ALL";
  const ids = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return void v.forEach(walk);
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (k === "in" && Array.isArray(val)) val.forEach((x) => ids.add(String(x)));
        else walk(val);
      }
    }
  };
  walk(where);
  return [...ids].sort();
}

describe("Admin — own business only, every tab", () => {
  for (const [tab, side] of [
    ["Received", "owner"],
    ["Sent", "referrer"],
    ["All", "either"],
  ] as const) {
    it(`${tab}: admits only their own business`, async () => {
      asMemberOf(WEBB);
      const where = await leadAccessWhere("webb-admin", false, side);
      expect(admitted(where)).toEqual([...WEBB.members].sort());
    });

    it(`${tab}: never admits another business`, async () => {
      asMemberOf(WEBB);
      const where = await leadAccessWhere("webb-admin", false, side);
      const ids = admitted(where);
      expect(ids).not.toBe("ALL");
      expect(ids).not.toContain("cole-admin");
    });
  }
});

describe("Staff — own business only, every tab", () => {
  for (const side of ["owner", "referrer", "either"] as const) {
    it(`${side}: admits only their own business`, async () => {
      asMemberOf(WEBB);
      const ids = admitted(await leadAccessWhere("webb-staff", false, side));
      expect(ids).toEqual([...WEBB.members].sort());
      expect(ids).not.toContain("cole-admin");
    });
  }
});

describe("Super Admin — club-wide OFF is their own business", () => {
  for (const side of ["owner", "referrer", "either"] as const) {
    it(`${side}: scoped to their own business, not the club`, async () => {
      asMemberOf(SUPER);
      const ids = admitted(await leadAccessWhere("super-admin", false, side));
      // The bug this guards: club-wide used to be implied by the role, so a
      // Super Admin was never scoped to their own business.
      expect(ids).not.toBe("ALL");
      expect(ids).toEqual([...SUPER.members].sort());
    });
  }
});

describe("Super Admin — club-wide ON is the whole club", () => {
  for (const side of ["owner", "referrer", "either"] as const) {
    it(`${side}: unrestricted`, async () => {
      asMemberOf(SUPER);
      expect(admitted(await leadAccessWhere("super-admin", true, side))).toBe("ALL");
    });
  }

  it("includes the Super Admin's own leads, not just other businesses'", async () => {
    asMemberOf(SUPER);
    // An unrestricted filter necessarily includes their own — the failure mode
    // would be an "exclude self" clause, which must not exist.
    const where = await leadAccessWhere("super-admin", true);
    expect(JSON.stringify(where)).not.toContain("not");
  });
});

describe("authorization — club-wide cannot be forced", () => {
  it("an Admin passing the flag is still scoped to their business", async () => {
    asMemberOf(WEBB);
    // Callers must resolve clubWide from the ROLE before calling; the guard is
    // that no caller passes a role straight through any more.
    const ids = admitted(await leadAccessWhere("webb-admin", false, "either"));
    expect(ids).not.toBe("ALL");
  });

  it("no caller grants club-wide from a role alone", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const files = [
      "src/app/api/leads/[id]/route.ts",
      "src/app/api/leads/[id]/status/route.ts",
      "src/app/api/leads/[id]/convert/route.ts",
      "src/app/api/leads/[id]/sent-status/route.ts",
      "src/app/api/leads/[id]/comments/route.ts",
      "src/app/api/leads/[id]/revenue/route.ts",
      "src/app/api/leads/[id]/sent-detail/route.ts",
      "src/app/(dashboard)/leads/[id]/page.tsx",
      "src/server/ai-context.ts",
    ];
    for (const f of files) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      // The leaks were `isAdmin ? {} : ...` and passing `admin` as the scope.
      // isAdminOrAbove() is true for a business Admin, so both widened Admin access.
      expect(src).not.toMatch(/leadAccessWhere\([^,]+,\s*(admin\b|isAdmin\()/);
      expect(src).not.toMatch(/\(admin \? \{\} :/);
      expect(src).not.toMatch(/\(isAdmin\(user\.role\) \? \{\} :/);
    }
  });
});

describe("the scope never falls open", () => {
  it("a user with no business still gets a filter, not everything", async () => {
    db.findUnique.mockResolvedValue({ businessId: null });
    const ids = await colleagueIdsFor("orphan");
    expect(ids).toEqual(["orphan"]);
    const where = await leadAccessWhere("orphan", false);
    expect(admitted(where)).not.toBe("ALL");
  });
});


describe("writes never widen, even for a Super Admin", () => {
  it("the mutating lead routes pass false, not a role", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    // A Super Admin can SEE another business's lead on the Club wide board, but
    // must not restage, convert or delete it — that board is read-only.
    for (const f of [
      "src/app/api/leads/[id]/status/route.ts",
      "src/app/api/leads/[id]/convert/route.ts",
      "src/app/api/leads/[id]/sent-status/route.ts",
    ]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).toMatch(/leadAccessWhere\(user\.id, false,/);
    }
  });

  it("the shared helper separates read and write scope", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(process.cwd(), "src/app/api/leads/[id]/route.ts"), "utf8");
    expect(src).toMatch(/accessWhere\(a\.user, id, isSuperAdmin\(a\.user\.role\)\)/); // GET
    expect(src).toMatch(/accessWhere\(user, id, false\)/); // PATCH + DELETE
  });
});

describe("a Super Admin can open what Club wide shows them", () => {
  it("read routes grant club-wide by role", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    for (const f of [
      "src/app/api/leads/[id]/sent-detail/route.ts",
      "src/app/api/leads/[id]/comments/route.ts",
      "src/app/api/leads/[id]/revenue/route.ts",
    ]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).toMatch(/leadAccessWhere\(user\.id, isSuperAdmin\(user\.role\)\)/);
    }
  });
});

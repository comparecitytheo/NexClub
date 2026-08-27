import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { isAdminOrAbove, isSuperAdmin } from "@/lib/rbac";

/**
 * `isAdminOrAbove` is named for what it does.
 *
 * As `isAdmin` it read like "is this person a business admin", but returns true
 * for a Super Admin too. That misreading is what let business Admins reach other
 * businesses' lead records: nine files used it to widen SCOPE when it is only a
 * PERMISSION gate.
 */
describe("the predicate does what its name says", () => {
  it("is true for a business Admin", () => {
    expect(isAdminOrAbove("ADMIN")).toBe(true);
  });

  it("is ALSO true for a Super Admin — the 'or above' part", () => {
    expect(isAdminOrAbove("SUPER_ADMIN")).toBe(true);
  });

  it("is false for staff", () => {
    for (const role of ["SALES_REP", "SUPPORT_AGENT"] as const) {
      expect(isAdminOrAbove(role)).toBe(false);
    }
  });

  it("is distinct from isSuperAdmin, which is the narrow check", () => {
    expect(isSuperAdmin("ADMIN")).toBe(false);
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
  });
});

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("the old name cannot come back", () => {
  it("nothing imports or calls isAdmin(", () => {
    const offenders: string[] = [];
    for (const f of sourceFiles(join(process.cwd(), "src"))) {
      const src = readFileSync(f, "utf8");
      // Component props named isAdmin are fine — they are booleans, not calls.
      if (/\bisAdmin\(/.test(src)) offenders.push(f);
      if (/import \{[^}]*\bisAdmin\b[^}]*\} from "@\/lib\/rbac"/.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it("rbac exports the new name only", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/rbac.ts"), "utf8");
    expect(src).toMatch(/export function isAdminOrAbove\(/);
    expect(src).not.toMatch(/export function isAdmin\(/);
  });
});

describe("it is never used to widen lead scope", () => {
  it("no lead route derives its scope from the permission gate", () => {
    // Scope comes from the business helpers; this predicate answers "may they
    // perform an admin action", which is a different question.
    for (const f of sourceFiles(join(process.cwd(), "src/app/api/leads"))) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/leadAccessWhere\([^,]+,\s*isAdminOrAbove\(/);
      expect(src).not.toMatch(/isAdminOrAbove\([^)]*\) \? \{\} :/);
    }
  });
});

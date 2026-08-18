import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SCHEMA = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const ROUTE = readFileSync(join(process.cwd(), "src/app/api/admin/businesses/[id]/route.ts"), "utf8");
const UI = readFileSync(join(process.cwd(), "src/components/admin/business-manager.tsx"), "utf8");
const PAGE = readFileSync(join(process.cwd(), "src/app/(dashboard)/admin/businesses/page.tsx"), "utf8");

const FIELDS = ["addressLine1", "addressLine2", "suburb", "state", "postcode"] as const;

/**
 * A business can record a street address.
 *
 * Stored as separate parts rather than one blob so the directory can show a
 * short form (suburb, state) without parsing, and so a later filter could use
 * suburb or postcode directly. All optional — plenty of members are sole
 * traders with no premises to list.
 */
describe("the schema", () => {
  it("stores the address on the business, in parts", () => {
    const block = SCHEMA.slice(SCHEMA.indexOf("model Business "));
    const body = block.slice(0, block.indexOf("\n}"));
    for (const f of FIELDS) {
      expect(body).toMatch(new RegExp(`${f}\\s+String\\?`));
    }
  });

  it("keeps every part optional", () => {
    const block = SCHEMA.slice(SCHEMA.indexOf("model Business "));
    const body = block.slice(0, block.indexOf("\n}"));
    for (const f of FIELDS) {
      expect(body).not.toMatch(new RegExp(`${f}\\s+String\\s`));
    }
  });
});

describe("saving", () => {
  it("accepts every part, and an empty string clears it", () => {
    for (const f of FIELDS) {
      expect(ROUTE).toMatch(new RegExp(`${f}: z\\.string\\(\\)`));
    }
    expect(ROUTE).toMatch(/=== "" \? null :/);
  });

  it("writes only the fields that were sent", () => {
    // Editing the name alone must not wipe an address that was set earlier.
    expect(ROUTE).toMatch(/\.filter\(\(k\) => parsed\.data\[k\] !== undefined\)/);
  });

  it("is Super Admin only and blocked during support mode", () => {
    expect(ROUTE).toMatch(/requireSuperAdminForWrite\(\)/);
  });

  it("records the change in the audit log", () => {
    // The before-state is selected from the database, not assumed, so the diff
    // is real rather than an empty object.
    expect(ROUTE).toMatch(/addressLine1: true, addressLine2: true, suburb: true, state: true, postcode: true/);
    expect(ROUTE).toMatch(/addressBefore/);
    expect(ROUTE).toMatch(/addressAfter/);
  });
});

describe("the admin UI", () => {
  it("seeds every field when opening the editor", () => {
    // An untouched field must save unchanged rather than blank.
    for (const f of FIELDS) {
      expect(UI).toMatch(new RegExp(`${f}: row\\.${f} \\?\\? ""`));
    }
  });

  it("sends name, chapter and address in one save", () => {
    // All three are business details edited together, so one request keeps them
    // consistent and produces a single audit entry.
    expect(UI).toMatch(/JSON\.stringify\(\{ name, chapterId, \.\.\.addr \}\)/);
  });

  it("sets the chapter in the editor, not as an inline list control", () => {
    // An always-visible dropdown in the list invites accidental changes.
    expect(UI).toMatch(/aria-label="Chapter"/);
    expect(UI).toMatch(/\{row\.chapterName \?\? "—"\}/);
  });

  it("allows saving an address without changing the name", () => {
    // The old guard returned early when the name was unchanged, which would
    // have silently discarded an address-only edit.
    expect(UI).not.toMatch(/name === row\.name/);
  });

  it("shows a short form in the list, not the whole address", () => {
    expect(UI).toMatch(/\[row\.suburb, row\.state\]\.filter\(Boolean\)\.join\(", "\)/);
  });

  it("the page supplies the fields to the component", () => {
    for (const f of FIELDS) {
      expect(PAGE).toMatch(new RegExp(`${f}: b\\.${f}`));
    }
  });
});


describe("who may change a business address", () => {
  const ME = readFileSync(join(process.cwd(), "src/app/api/users/me/route.ts"), "utf8");

  it("admins and above only — enforced on the SERVER", () => {
    // The address is shared by everyone at that business, so a staff member
    // changing it would change it for their director too. Hiding the field is
    // a courtesy; this check is the actual boundary.
    expect(ME).toMatch(/!isAdminOrAbove\(user\.role\)/);
    expect(ME).toMatch(/Only an admin can change the business address\./);
    expect(ME).toMatch(/status: 403/);
  });

  it("the form is read-only for staff", () => {
    // UI above is the ADMIN manager; the member's own form is a different file.
    const SETTINGS = readFileSync(join(process.cwd(), "src/components/settings/profile-settings.tsx"), "utf8");
    expect(SETTINGS).toMatch(/readOnly=\{!canManageStaff\}/);
    expect(SETTINGS).toMatch(/Set by a director at your business/);
  });

  it("a staff save omits the address entirely", () => {
    // Otherwise saving a bio would send the address unchanged and the whole
    // request would come back 403.
    const SETTINGS = readFileSync(join(process.cwd(), "src/components/settings/profile-settings.tsx"), "utf8");
    expect(SETTINGS).toMatch(/if \(canManageStaff\) return rest;/);
    expect(SETTINGS).toMatch(/withoutAddress/);
  });

  it("a Super Admin can still set it from Admin -> Businesses", () => {
    const BIZ = readFileSync(join(process.cwd(), "src/app/api/admin/businesses/[id]/route.ts"), "utf8");
    expect(BIZ).toMatch(/requireSuperAdminForWrite\(\)/);
    expect(BIZ).toMatch(/addressLine1: z\.string\(\)/);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SCHEMA = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const LIST = readFileSync(join(process.cwd(), "src/app/api/admin/chapters/route.ts"), "utf8");
const ONE = readFileSync(join(process.cwd(), "src/app/api/admin/chapters/[id]/route.ts"), "utf8");
const BIZ = readFileSync(join(process.cwd(), "src/app/api/admin/businesses/[id]/route.ts"), "utf8");
const DIR = readFileSync(join(process.cwd(), "src/components/directory/member-directory.tsx"), "utf8");

/**
 * Chapters group members geographically (The Shire, Parramatta, CBD).
 *
 * Modelled as a RELATION, not a free-text field like `industry`: renaming then
 * updates every member at once, and a chapter cannot be deleted out from under
 * the people in it.
 */
describe("the data model", () => {
  it("hangs off the BUSINESS, not the member", () => {
    // A chapter is a LOCATION. Every member of a business is in that business's
    // chapter by definition, so storing it per person would let colleagues drift
    // apart and would have to be re-set for each new hire.
    expect(SCHEMA).toMatch(/model Chapter \{/);
    const business = SCHEMA.slice(SCHEMA.indexOf("model Business "));
    expect(business.slice(0, business.indexOf("\n}"))).toMatch(/chapterId\s+String\?/);
    const user = SCHEMA.slice(SCHEMA.indexOf("model User "));
    expect(user.slice(0, user.indexOf("\n}"))).not.toMatch(/chapterId/);
  });

  it("deleting a chapter never deletes businesses", () => {
    const block = SCHEMA.slice(SCHEMA.indexOf("chapter        Chapter?"));
    expect(block.slice(0, 200)).toMatch(/onDelete: SetNull/);
  });

  it("names are unique per organisation", () => {
    expect(SCHEMA).toMatch(/@@unique\(\[organizationId, name\]\)/);
  });

  it("is scoped to an organisation and indexed for lookup", () => {
    expect(SCHEMA).toMatch(/@@index\(\[organizationId, chapterId\]\)/);
  });
});

describe("only a Super Admin manages chapters", () => {
  it("reads require Super Admin", () => {
    expect(LIST).toMatch(/requireSuperAdmin\(\)/);
  });

  it("writes are blocked during support mode", () => {
    expect(LIST).toMatch(/requireSuperAdminForWrite\(\)/);
    expect(ONE).toMatch(/requireSuperAdminForWrite\(\)/);
  });

  it("every query is scoped to the caller's organisation", () => {
    expect(LIST).toMatch(/organizationId: user\.organizationId/);
    expect(ONE).toMatch(/organizationId: user\.organizationId/);
  });
});

describe("duplicate names are refused case-insensitively", () => {
  it("on create — 'the shire' cannot join 'The Shire'", () => {
    // The unique index is exact-match only and would let that through.
    expect(LIST).toMatch(/mode: "insensitive"/);
  });

  it("on rename, excluding the chapter itself", () => {
    expect(ONE).toMatch(/mode: "insensitive"/);
    expect(ONE).toMatch(/NOT: \{ id \}/);
  });
});

describe("deleting is refused while businesses are assigned", () => {
  it("counts businesses first and blocks with a 409", () => {
    // SetNull means deleting would silently strip the chapter from every
    // business in it — recoverable but invisible, and nobody would know which
    // to put back.
    expect(ONE).toMatch(/if \(chapter\._count\.businesses > 0\)/);
    expect(ONE).toMatch(/Move them to another chapter first/);
  });
});

describe("assignment cannot cross organisations", () => {
  it("verifies the chapter belongs to this org before writing it", () => {
    // The id comes from the client, so a crafted request could otherwise point
    // a business at another organisation's chapter.
    expect(BIZ).toMatch(/prisma\.chapter\.findFirst\(\{[\s\S]*?organizationId: user\.organizationId/);
    expect(BIZ).toMatch(/Unknown chapter\./);
  });

  it("an empty value clears the chapter rather than erroring", () => {
    expect(BIZ).toMatch(/chapterId: z\.string\(\)\.trim\(\)\.optional\(\)\.or\(z\.literal\(""\)\)/);
  });
});

describe("chapters are organisational only", () => {
  it("never appear in lead scoping", () => {
    // Access stays scoped by business. A chapter must not widen it.
    for (const f of [
      "src/server/businesses.ts",
      "src/app/api/leads/route.ts",
    ]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).not.toMatch(/chapterId/);
    }
  });
});

describe("the directory", () => {
  it("filters by chapter alongside industry", () => {
    expect(DIR).toMatch(/chapter !== ALL_CHAPTERS/);
  });

  it("filters whole businesses, since the chapter is the business's location", () => {
    expect(DIR).toMatch(/b\.chapter\?\.name !== chapter/);
  });

  it("hides the filter entirely when no chapters exist", () => {
    expect(DIR).toMatch(/chapters\.length > 0 &&/);
  });
});

describe("chapter appears beside the business name", () => {
  it("is rendered from the business, not the member", () => {
    const CARD = readFileSync(join(process.cwd(), "src/components/directory/business-card.tsx"), "utf8");
    expect(CARD).toMatch(/business\.chapter/);
    // A member no longer carries one of its own.
    expect(CARD).not.toMatch(/m\.chapter/);
  });

  it("sits on the same baseline as the name", () => {
    // Centring the boxes lines up different font sizes badly; the smaller
    // chapter text floated above the business name.
    const CARD = readFileSync(join(process.cwd(), "src/components/directory/business-card.tsx"), "utf8");
    expect(CARD).toMatch(/items-baseline/);
  });
});

describe("inline creation from the member form", () => {
  const DETAIL = readFileSync(join(process.cwd(), "src/components/admin/admin-user-detail.tsx"), "utf8");

  it("offers an add option in the select", () => {
    expect(DETAIL).toMatch(/\+ Add a new chapter/);
  });

  it("posts to the same guarded endpoint, not a separate path", () => {
    // The convenience UI must not be its own back door.
    expect(DETAIL).toMatch(/fetch\("\/api\/admin\/chapters", \{\s*method: "POST"/);
  });

  it("selects the new chapter so the member can be saved immediately", () => {
    expect(DETAIL).toMatch(/setField\("chapterId"\)\(d\.chapter\.id\)/);
  });
});

describe("admin panel groups the membership sections", () => {
  it("groups the club-wide lists together, Industries then Chapters", () => {
    // Order was changed on request: Settings moved up behind Overview, and the
    // two list-management tabs sit together with Industries first.
    const TABS = readFileSync(join(process.cwd(), "src/components/admin/admin-tabs.tsx"), "utf8");
    const order = [...TABS.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual([
      "Overview",
      "Settings",
      "Members",
      "Businesses",
      "Industries",
      "Chapters",
      "Reporting",
      "Audit log",
    ]);
  });
});

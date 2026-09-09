import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { groupBusinesses } from "@/lib/directory";
import type { DirectoryMember } from "@/components/directory/business-card";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const DIRECTORY_PAGE = read("src/app/(dashboard)/directory/page.tsx");
const ADMIN_USER = read("src/app/api/admin/users/[id]/route.ts");

const member = (over: Partial<DirectoryMember> = {}): DirectoryMember => ({
  id: "u1",
  name: "Uma",
  role: "SALES_REP",
  businessId: "b1",
  businessName: "Shire Plumbing",
  industry: "Trades",
  services: null,
  phone: null,
  bio: null,
  avatarUrl: null,
  businessLogoUrl: null,
  businessLogoUserId: null,
  business: { logoUserId: null, chapter: { id: "c1", name: "The Shire" } },
  ...over,
});

/**
 * The Chapter dropdown in the directory listed the right options and then
 * filtered every business out of view.
 *
 * The page built its rows with `({ business, ...m })`, dropping the relation,
 * while groupBusinesses reads the chapter from `m.business?.chapter`. Every
 * group was therefore built with chapter: null. `business` is optional on
 * DirectoryMember, so removing it type-checked perfectly.
 */
describe("the directory carries the chapter through to the grouper", () => {
  it("keeps the business relation on the rows it passes down", () => {
    expect(DIRECTORY_PAGE).not.toMatch(/members\.map\(\(\{\s*business,/);
    expect(DIRECTORY_PAGE).toMatch(/business: \{ select: \{[^}]*chapter/);
  });

  it("groups a member into a business that knows its chapter", () => {
    const [group] = groupBusinesses([member()]);
    expect(group.chapter).toEqual({ id: "c1", name: "The Shire" });
  });

  it("leaves the chapter null when the business has none", () => {
    const [group] = groupBusinesses([member({ business: { logoUserId: null, chapter: null } })]);
    expect(group.chapter).toBeNull();
  });

  it("puts colleagues in one group that keeps the chapter", () => {
    const groups = groupBusinesses([
      member(),
      member({ id: "u2", name: "Ben" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
    expect(groups[0].chapter?.name).toBe("The Shire");
  });
});

/**
 * The member editor offers a chapter dropdown. Its value was sent to an endpoint
 * whose schema did not declare it, and a zod object strips what it does not
 * declare — so every chapter set from that screen was silently discarded, and
 * the save reported success.
 */
describe("assigning a chapter from the member editor", () => {
  it("declares chapterId, so it survives parsing", () => {
    const schema = ADMIN_USER.slice(
      ADMIN_USER.indexOf("adminEditProfileSchema"),
      ADMIN_USER.indexOf("export async function GET")
    );
    expect(schema).toMatch(/chapterId/);
  });

  it("writes it to the business, never to the user", () => {
    expect(ADMIN_USER).toMatch(/const \{ chapterId, \.\.\.profileFields \} = parsed\.data/);
    expect(ADMIN_USER).toMatch(/prisma\.business\.update\(\{[\s\S]{0,120}chapterId: chapterId \|\| null/);
  });

  it("refuses when the member belongs to no business", () => {
    // A chapter is a property of the business, so there is nowhere to put it.
    expect(ADMIN_USER).toMatch(/does not belong to a business yet/);
  });

  it("rejects a chapter that no longer exists", () => {
    expect(ADMIN_USER).toMatch(/That chapter no longer exists/);
  });

  /**
   * The destructive half. The editor seeds its dropdown from profile.chapterId,
   * which the GET never returned — so the form always opened on "No chapter",
   * and saving wrote that back, clearing the business's chapter as a side
   * effect of editing a phone number.
   */
  it("returns the current chapter so the form cannot blank it", () => {
    expect(ADMIN_USER).toMatch(/business: \{ select: \{ chapterId: true \} \}/);
    expect(ADMIN_USER).toMatch(/chapterId: business\?\.chapterId \?\? null/);
  });
});

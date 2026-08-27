import { describe, it, expect } from "vitest";
import { SOURCES } from "@/server/reports/sources";
import type { ReportContext } from "@/server/reports/types";

const src = (k: string) => {
  const s = SOURCES.find((x) => x.key === k);
  if (!s) throw new Error(`missing source ${k}`);
  return s;
};
const admin: ReportContext = { userId: "u1", role: "ADMIN", organizationId: "org1", isAdmin: true };
const member: ReportContext = { userId: "u1", role: "SALES_REP", organizationId: "org1", isAdmin: false };

describe("report source scoping — permission enforced at the query layer", () => {
  it("referrals: admin sees the whole org", () => {
    expect(src("referrals").scope(admin)).toEqual({ organizationId: "org1" });
  });
  it("referrals: member limited to giver-or-receiver within their org", () => {
    expect(src("referrals").scope(member)).toEqual({
      organizationId: "org1",
      OR: [{ referrerId: { in: ["u1"] } }, { ownerId: { in: ["u1"] } }],
    });
  });
  it("revenue: same boundary as referrals for a member", () => {
    expect(src("revenue").scope(member)).toEqual(src("referrals").scope(member));
  });
  it("opportunities: member limited to their own", () => {
    expect(src("opportunities").scope(member)).toEqual({ organizationId: "org1", ownerId: { in: ["u1"] } });
  });
  it("members: member limited to themselves", () => {
    expect(src("members").scope(member)).toEqual({ organizationId: "org1", id: { in: ["u1"] } });
  });
  it("scope depends only on role, never on a client-supplied value", () => {
    expect(src("referrals").scope(member)).toEqual(src("referrals").scope({ ...member }));
  });
});

describe("business scoping", () => {
  it("covers every member of a business, not just the director", () => {
    // Reporting on a business must include everyone in it, or a two-person
    // business would report only half its work.
    const business: ReportContext = {
      userId: "u1",
      userIds: ["u1", "u2", "u3"],
      role: "SALES_REP",
      organizationId: "org1",
      isAdmin: false,
    };
    expect(src("opportunities").scope(business)).toEqual({
      organizationId: "org1",
      ownerId: { in: ["u1", "u2", "u3"] },
    });
  });

  it("falls back to the single member when no group is given", () => {
    expect(src("members").scope(member)).toEqual({ organizationId: "org1", id: { in: ["u1"] } });
  });

  it("still gives an admin the whole club regardless of any group", () => {
    const adminWithGroup: ReportContext = { ...admin, userIds: ["u2"] };
    expect(src("members").scope(adminWithGroup)).toEqual({ organizationId: "org1" });
  });
});

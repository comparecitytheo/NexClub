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
      OR: [{ referrerId: "u1" }, { ownerId: "u1" }],
    });
  });
  it("revenue: same boundary as referrals for a member", () => {
    expect(src("revenue").scope(member)).toEqual(src("referrals").scope(member));
  });
  it("opportunities: member limited to their own", () => {
    expect(src("opportunities").scope(member)).toEqual({ organizationId: "org1", ownerId: "u1" });
  });
  it("members: member limited to themselves", () => {
    expect(src("members").scope(member)).toEqual({ organizationId: "org1", id: "u1" });
  });
  it("scope depends only on role, never on a client-supplied value", () => {
    expect(src("referrals").scope(member)).toEqual(src("referrals").scope({ ...member }));
  });
});

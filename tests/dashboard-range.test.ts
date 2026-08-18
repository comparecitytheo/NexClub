import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const METRICS = readFileSync(join(process.cwd(), "src/server/metrics.ts"), "utf8");
const PAGE = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"), "utf8");

/**
 * The dashboard's date picker must move every number on the page.
 *
 * The bug: only the revenue and conversion cards read the range. The headline
 * stage cards and the per-role sections were all-time totals, so switching
 * 7/30/90 days changed two cards and left the rest identical — which reads as
 * the picker being broken rather than as a deliberate scope.
 */
describe("every metrics call accepts the range", () => {
  it("stage breakdown", () => {
    expect(METRICS).toMatch(/getLeadStageBreakdown\([\s\S]{0,400}range\?: \{ from: Date; to: Date \}/);
  });

  it("member metrics", () => {
    expect(METRICS).toMatch(/getMemberMetrics\([\s\S]{0,200}range\?: \{ from: Date; to: Date \}/);
  });

  it("admin metrics", () => {
    expect(METRICS).toMatch(/getAdminMetrics\(orgId: string, range\?: \{ from: Date; to: Date \}\)/);
  });
});

describe("the range is actually applied, not just accepted", () => {
  it("each function builds a createdAt filter from it", () => {
    // Leads filter on dateReceived (the business date, which backdating sets);
    // deals have no such field and stay on createdAt.
    const leadFilters = METRICS.match(/\{ dateReceived: \{ gte: range\.from, lte: range\.to \} \}/g);
    const dealFilters = METRICS.match(/\{ createdAt: \{ gte: range\.from, lte: range\.to \} \}/g);
    expect(leadFilters?.length).toBeGreaterThanOrEqual(3);
    expect(dealFilters?.length).toBeGreaterThanOrEqual(2);
  });

  it("spreads that filter into the stage queries", () => {
    expect(METRICS).toMatch(/where: \{ organizationId: orgId, ownerId: mine, \.\.\.(inRange|leadRange) \}/);
  });
});

describe("the page passes the range to every section", () => {
  it("stage cards", () => {
    expect(PAGE).toMatch(/getLeadStageBreakdown\(user\.id, user\.organizationId, range\)/);
  });

  it("revenue and conversion cards", () => {
    expect(PAGE).toMatch(/getRangeKpis\(user\.id, user\.organizationId, range\)/);
  });

  it("both per-role sections", () => {
    expect(PAGE).toMatch(/<AdminDashboard[^>]*range=\{range\}/);
    expect(PAGE).toMatch(/<MemberDashboard[^>]*range=\{range\}/);
  });
});

describe("fixed windows keep their own scope", () => {
  it("leaves the 14-day activity chart and month-to-date column alone", () => {
    // Both name their window in the heading, so scoping them to the picker
    // would make the label lie.
    expect(METRICS).toMatch(/since\.setDate\(since\.getDate\(\) - 13\)/);
    expect(METRICS).toMatch(/monthStart\.setDate\(1\)/);
  });
});

describe("the Individual business card covers the business", () => {
  it("uses the business, not the viewer alone", () => {
    // The card is labelled "Individual business" but counted only the viewer's
    // own leads, so a colleague's were missing.
    expect(METRICS).toMatch(/const team = await colleagueIdsFor\(userId\);/);
    expect(METRICS).toMatch(/ownerId: mine/);
  });
});


describe("scopes match their labels", () => {
  it("the KPI cards' \"Individual business\" covers the business, not one person", () => {
    // The card is labelled "Individual business" but counted only the viewer,
    // so a colleague's revenue was missing from a business figure.
    expect(METRICS).toMatch(/const indTeam = await colleagueIdsFor\(userId\);/);
    expect(METRICS).toMatch(/const indBase = \{ organizationId: orgId, ownerId: indOwner/);
  });

  it("the club scope stays the whole organisation", () => {
    expect(METRICS).toMatch(/const clubBase = \{ organizationId: orgId, \.\.\.window \};/);
  });
});

describe("the leaderboard follows the range where it does not name a window", () => {
  it("scopes leads received, leads sent and won to the picker", () => {
    expect(METRICS).toMatch(/by: \["ownerId"\], where: \{ organizationId: orgId, \.\.\.(inRange|leadRange) \}/);
    expect(METRICS).toMatch(/by: \["referrerId"\], where: \{ organizationId: orgId, \.\.\.(inRange|leadRange) \}/);
    expect(METRICS).toMatch(/by: \["ownerId"\], where: \{ organizationId: orgId, \.\.\.dealRange, stage: "CLOSED_WON" \}/);
  });

  it("leaves the column headed \"this month\" on its own window", () => {
    expect(METRICS).toMatch(/dateReceived: \{ gte: monthStart \}/);
  });
});

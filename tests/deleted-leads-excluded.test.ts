import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { summariseLeadStages } from "@/lib/labels";

const METRICS = readFileSync(join(process.cwd(), "src/server/metrics.ts"), "utf8");
const SOURCES = readFileSync(join(process.cwd(), "src/server/reports/sources.ts"), "utf8");

/**
 * A deleted lead is a LOST lead.
 *
 * It came in and did not convert, whatever stage it was at when it was removed.
 * So it counts toward the lead total, toward Lost, and toward the denominator of
 * conversion — and never toward won, revenue, open pipeline or the leaderboard.
 */
describe("the stage cards", () => {
  it("count deleted leads in the total", () => {
    const { total } = summariseLeadStages([
      { status: "NEW", count: 3 },
      { status: "CLOSED_LOST", count: 7 },
    ] as never);
    expect(total).toBe(10);
  });

  it("fold DELETED into the Lost column", () => {
    expect(METRICS).toMatch(/g\.status === "DELETED" \|\| g\.status === "CLOSED_LOST"/);
    expect(METRICS).toMatch(/rows\.push\(\{ status: "CLOSED_LOST", count: lost \}\)/);
  });

  it("so the total equals the sum of its columns again", () => {
    const { total, stages } = summariseLeadStages([
      { status: "NEW", count: 3 },
      { status: "CLOSED_LOST", count: 7 },
    ] as never);
    const columns = stages.reduce((sum, s) => sum + Number(s.value), 0);
    expect(columns).toBe(total);
  });
});

describe("conversion treats a deleted lead as not converted", () => {
  it("counts it in the denominator", () => {
    // received has no deleted-lead filter, so every lead handled is counted.
    expect(METRICS).toMatch(/prisma\.lead\.count\(\{ where: indBase \}\)/);
    expect(METRICS).toMatch(/prisma\.lead\.count\(\{ where: clubBase \}\)/);
  });

  it("keeps it out of the numerator", () => {
    // won filters CLOSED_WON, which a deleted lead's status can never be.
    expect(METRICS).toMatch(/where: \{ \.\.\.indBase, status: "CLOSED_WON" \}/);
  });

  it("does the same in reporting", () => {
    expect(SOURCES).toMatch(/baseWhere: \{ deletedAt: null \}/);
    expect(SOURCES).toMatch(/raw === "DELETED" \? "CLOSED_LOST" : raw/);
  });
});

describe("a deleted lead is not active and not revenue", () => {
  it("is excluded from the active pipeline count", () => {
    // CLOSED omitted DELETED, so a deleted lead counted as an active lead.
    expect(METRICS).toMatch(/const CLOSED_LEAD = \["CLOSED_WON", "CLOSED_LOST", "DELETED"\] as const;/);
    // Spread at the call site: `as const` makes these readonly tuples, and
    // Prisma's `notIn` takes a mutable array. The list is what matters here.
    expect(METRICS).toMatch(/status: \{ notIn: \[\.\.\.CLOSED_LEAD\] \}/);
  });

  it("keeps the deal-stage list separate, since DELETED is not a deal stage", () => {
    expect(METRICS).toMatch(/const CLOSED = \["CLOSED_WON", "CLOSED_LOST"\] as const;/);
    expect(METRICS).toMatch(/stage: \{ notIn: \[\.\.\.CLOSED\] \}/);
  });

  it("never appears in revenue", () => {
    expect(SOURCES).toMatch(/baseWhere: \{ deletedAt: null, status: "CLOSED_WON" \}/);
  });
});

describe("the leaderboard counts the effort, not just the outcome", () => {
  it("includes deleted leads in leads sent and received", () => {
    // Sending a lead is work that happened. Whether it was later deleted does
    // not undo the referral, so it still counts toward the sender's month.
    expect(METRICS).toMatch(/by: \["ownerId"\], where: \{ organizationId: orgId, \.\.\.leadRange \}/);
    expect(METRICS).toMatch(/by: \["referrerId"\], where: \{ organizationId: orgId, \.\.\.leadRange \}/);
  });

  it("counts them in the this-month column too", () => {
    expect(METRICS).toMatch(/by: \["referrerId"\], where: \{ organizationId: orgId, dateReceived: \{ gte: monthStart \} \}/);
  });

  it("no longer needs a deleted-lead filter anywhere", () => {
    // One rule now: deleted is lost. Won and revenue exclude it by status.
    expect(METRICS).not.toMatch(/LIVE_LEAD/);
  });
});

describe("status charts show deleted leads as lost", () => {
  it("folds DELETED into CLOSED_LOST rather than dropping it", () => {
    // The charts plot only the five live statuses, so without the fold the
    // deleted leads would be fetched and silently discarded.
    expect(METRICS).toMatch(/g\.status === "DELETED" \? "CLOSED_LOST" : g\.status/);
  });
});

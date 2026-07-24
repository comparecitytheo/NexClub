import { describe, it, expect } from "vitest";
import {
  revenue,
  totalValue,
  referralCount,
  conversionRate,
  pipelineValue,
  closedDeals,
  avgReferralValue,
  acceptanceRate,
  forecast,
} from "@/server/reports/metrics";
import type { MetricRow, ReportContext } from "@/server/reports/types";

const ctx: ReportContext = { userId: "u", role: "ADMIN", organizationId: "o", isAdmin: true };

const row = (p: Partial<MetricRow>): MetricRow => ({
  value: 0, weight: 0, won: false, lost: false, open: false, accepted: false,
  giverId: null, receiverId: null, memberId: null, industry: null, service: null,
  status: null, stage: null, date: null, ...p,
});

const rows: MetricRow[] = [
  row({ value: 100, won: true, accepted: true }),
  row({ value: 50, lost: true }),
  row({ value: 200, open: true, weight: 0.5, accepted: true }),
  row({ value: 25, open: true, weight: 0.2 }),
];

describe("report metric calculators (pure)", () => {
  it("revenue sums won value only", () => expect(revenue(rows, ctx)).toBe(100));
  it("totalValue sums all value", () => expect(totalValue(rows, ctx)).toBe(375));
  it("referralCount counts rows", () => expect(referralCount(rows, ctx)).toBe(4));
  it("closedDeals counts won", () => expect(closedDeals(rows, ctx)).toBe(1));
  it("conversionRate = won / total", () => expect(conversionRate(rows, ctx)).toBe(0.25));
  it("pipelineValue sums open value", () => expect(pipelineValue(rows, ctx)).toBe(225));
  it("avgReferralValue = mean value", () => expect(avgReferralValue(rows, ctx)).toBe(375 / 4));
  it("acceptanceRate = accepted / total", () => expect(acceptanceRate(rows, ctx)).toBe(0.5));
  it("forecast = probability-weighted open value", () =>
    expect(forecast(rows, ctx)).toBeCloseTo(200 * 0.5 + 25 * 0.2));

  it("ratios and sums return 0 on an empty group (no divide-by-zero)", () => {
    expect(conversionRate([], ctx)).toBe(0);
    expect(avgReferralValue([], ctx)).toBe(0);
    expect(acceptanceRate([], ctx)).toBe(0);
    expect(revenue([], ctx)).toBe(0);
    expect(forecast([], ctx)).toBe(0);
  });
});

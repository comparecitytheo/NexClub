import type { Metric, MetricRow } from "./types";

// Every calculator is pure over the rows in one group — no DB, no shared state —
// so each is unit-testable with plain fixtures. Ratio metrics guard against an
// empty group rather than dividing by zero.
const sum = (rows: MetricRow[], pick: (r: MetricRow) => number) => rows.reduce((a, r) => a + pick(r), 0);
const count = (rows: MetricRow[], pred: (r: MetricRow) => boolean) =>
  rows.reduce((a, r) => a + (pred(r) ? 1 : 0), 0);

export const revenue: Metric["compute"] = (rows) => sum(rows.filter((r) => r.won), (r) => r.value);
export const totalValue: Metric["compute"] = (rows) => sum(rows, (r) => r.value);
export const referralCount: Metric["compute"] = (rows) => rows.length;
export const closedDeals: Metric["compute"] = (rows) => count(rows, (r) => r.won);
export const conversionRate: Metric["compute"] = (rows) =>
  rows.length ? count(rows, (r) => r.won) / rows.length : 0;
export const pipelineValue: Metric["compute"] = (rows) => sum(rows.filter((r) => r.open), (r) => r.value);
export const avgReferralValue: Metric["compute"] = (rows) =>
  rows.length ? sum(rows, (r) => r.value) / rows.length : 0;
export const acceptanceRate: Metric["compute"] = (rows) =>
  rows.length ? count(rows, (r) => r.accepted) / rows.length : 0;
// Probability-weighted open pipeline — the agreed Revenue Forecast definition.
export const forecast: Metric["compute"] = (rows) => sum(rows.filter((r) => r.open), (r) => r.value * r.weight);

// Registered set. The custom builder can expose a subset; pre-built reports may
// use any of them (e.g. totalValue powers Lost Revenue, forecast powers the
// Revenue Forecast report).
export const METRICS: Metric[] = [
  { key: "revenue", label: "Revenue", sources: ["referrals", "revenue", "opportunities"], format: "currency", compute: revenue },
  { key: "totalValue", label: "Total value", sources: ["referrals", "revenue", "opportunities"], format: "currency", compute: totalValue },
  { key: "referralCount", label: "Referral count", sources: ["referrals", "revenue"], format: "number", compute: referralCount },
  { key: "conversionRate", label: "Conversion rate", sources: ["referrals", "revenue"], format: "percent", compute: conversionRate },
  { key: "pipelineValue", label: "Pipeline value", sources: ["opportunities", "referrals"], format: "currency", compute: pipelineValue },
  { key: "closedDeals", label: "Closed deals", sources: ["opportunities", "referrals", "revenue"], format: "number", compute: closedDeals },
  { key: "avgReferralValue", label: "Average referral value", sources: ["referrals", "revenue"], format: "currency", compute: avgReferralValue },
  { key: "acceptanceRate", label: "Acceptance rate", sources: ["referrals"], format: "percent", compute: acceptanceRate },
  { key: "forecast", label: "Revenue forecast", sources: ["opportunities"], format: "currency", compute: forecast },
];

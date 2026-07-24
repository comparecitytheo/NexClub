import type { ReportDefinition } from "./types";

// Every pre-built report is a config object consumed by the generic engine — no
// bespoke query code. To add one, append a definition here (or register from
// anywhere) and it appears in the catalogue. Member grouping resolves to an id;
// the UI maps ids to names.

const DATE: ReportDefinition["filters"] = ["dateRange", "member", "industry", "referralStatus"];

const REVENUE_REPORTS: ReportDefinition[] = [
  {
    key: "revenue.generated", title: "Revenue Generated", category: "revenue", dataSource: "revenue",
    memberAxis: "giver", dimensions: ["member", "industry", "date"], metrics: ["revenue", "referralCount"],
    filters: DATE, defaultGroupBy: ["member"], defaultMetrics: ["revenue"],
    defaultSort: { by: "revenue", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "revenue.received", title: "Revenue Received", category: "revenue", dataSource: "revenue",
    memberAxis: "receiver", dimensions: ["member", "industry", "date"], metrics: ["revenue", "referralCount"],
    filters: DATE, defaultGroupBy: ["member"], defaultMetrics: ["revenue"],
    defaultSort: { by: "revenue", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "revenue.by_member", title: "Revenue by Member", category: "revenue", dataSource: "revenue",
    dimensions: ["member"], metrics: ["revenue", "referralCount", "avgReferralValue"], filters: DATE,
    defaultGroupBy: ["member"], defaultMetrics: ["revenue"], defaultSort: { by: "revenue", dir: "desc" }, defaultViz: "bar",
  },
  {
    key: "revenue.by_industry", title: "Revenue by Industry", category: "revenue", dataSource: "revenue",
    dimensions: ["industry"], metrics: ["revenue", "referralCount"], filters: DATE,
    defaultGroupBy: ["industry"], defaultMetrics: ["revenue"], defaultSort: { by: "revenue", dir: "desc" }, defaultViz: "pie",
  },
  {
    key: "revenue.by_month", title: "Revenue by Month", category: "revenue", dataSource: "revenue",
    dimensions: ["date"], metrics: ["revenue", "referralCount"], filters: DATE,
    defaultGroupBy: ["date"], defaultMetrics: ["revenue"], defaultSort: { by: "date", dir: "asc" }, defaultViz: "line",
  },
  {
    key: "revenue.trends", title: "Revenue Trends", category: "revenue", dataSource: "revenue",
    dimensions: ["date", "industry"], metrics: ["revenue", "avgReferralValue"], filters: DATE,
    defaultGroupBy: ["date"], defaultMetrics: ["revenue"], defaultSort: { by: "date", dir: "asc" }, defaultViz: "line",
  },
  {
    key: "revenue.avg_per_referral", title: "Average Revenue per Referral", category: "revenue", dataSource: "referrals",
    dimensions: ["member", "industry"], metrics: ["avgReferralValue", "revenue", "referralCount"], filters: DATE,
    defaultMetrics: ["avgReferralValue"], defaultViz: "kpi",
  },
  {
    key: "revenue.top_earners", title: "Top Revenue Earners", category: "revenue", dataSource: "revenue",
    memberAxis: "receiver", dimensions: ["member"], metrics: ["revenue", "referralCount"], filters: DATE,
    defaultGroupBy: ["member"], defaultMetrics: ["revenue"], defaultSort: { by: "revenue", dir: "desc" }, defaultViz: "leaderboard",
  },
];

const REFERRAL_REPORTS: ReportDefinition[] = [
  {
    key: "referral.sent", title: "Referrals Sent", category: "referral", dataSource: "referrals",
    memberAxis: "giver", dimensions: ["member", "industry", "date"], metrics: ["referralCount", "revenue"],
    filters: DATE, defaultGroupBy: ["member"], defaultMetrics: ["referralCount"],
    defaultSort: { by: "referralCount", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "referral.received", title: "Referrals Received", category: "referral", dataSource: "referrals",
    memberAxis: "receiver", dimensions: ["member", "industry", "date"], metrics: ["referralCount", "revenue"],
    filters: DATE, defaultGroupBy: ["member"], defaultMetrics: ["referralCount"],
    defaultSort: { by: "referralCount", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "referral.pipeline", title: "Referral Pipeline", category: "referral", dataSource: "referrals",
    dimensions: ["referralStatus"], metrics: ["referralCount", "pipelineValue"], filters: DATE,
    defaultGroupBy: ["referralStatus"], defaultMetrics: ["referralCount", "pipelineValue"], defaultViz: "bar",
  },
  {
    key: "referral.status", title: "Referral Status", category: "referral", dataSource: "referrals",
    dimensions: ["referralStatus"], metrics: ["referralCount"], filters: DATE,
    defaultGroupBy: ["referralStatus"], defaultMetrics: ["referralCount"], defaultViz: "pie",
  },
  {
    key: "referral.conversion_rate", title: "Referral Conversion Rate", category: "referral", dataSource: "referrals",
    memberAxis: "receiver", dimensions: ["member", "industry"], metrics: ["conversionRate", "referralCount"],
    filters: DATE, defaultGroupBy: ["member"], defaultMetrics: ["conversionRate", "referralCount"],
    defaultSort: { by: "conversionRate", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "referral.acceptance_rate", title: "Referral Acceptance Rate", category: "referral", dataSource: "referrals",
    memberAxis: "receiver", dimensions: ["member"], metrics: ["acceptanceRate", "referralCount"], filters: DATE,
    defaultGroupBy: ["member"], defaultMetrics: ["acceptanceRate", "referralCount"],
    defaultSort: { by: "acceptanceRate", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "referral.avg_value", title: "Average Referral Value", category: "referral", dataSource: "referrals",
    dimensions: ["member", "industry"], metrics: ["avgReferralValue", "referralCount"], filters: DATE,
    defaultGroupBy: ["member"], defaultMetrics: ["avgReferralValue"], defaultSort: { by: "avgReferralValue", dir: "desc" }, defaultViz: "bar",
  },
];

// Member Performance is inherently cross-member; in this deployment only the
// Super Admin can open the Report Builder, so these run org-wide by definition.
const MEMBER_REPORTS: ReportDefinition[] = [
  {
    key: "member.top_referrers", title: "Top Referrers", category: "member", dataSource: "referrals",
    memberAxis: "giver", dimensions: ["member"], metrics: ["referralCount", "revenue"], filters: DATE,
    defaultGroupBy: ["member"], defaultMetrics: ["referralCount"], defaultSort: { by: "referralCount", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "member.top_revenue_generators", title: "Top Revenue Generators", category: "member", dataSource: "revenue",
    memberAxis: "giver", dimensions: ["member"], metrics: ["revenue", "referralCount"], filters: DATE,
    defaultGroupBy: ["member"], defaultMetrics: ["revenue"], defaultSort: { by: "revenue", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "member.highest_conversion", title: "Highest Conversion Rate", category: "member", dataSource: "referrals",
    memberAxis: "receiver", dimensions: ["member"], metrics: ["conversionRate", "referralCount"], filters: DATE,
    defaultGroupBy: ["member"], defaultMetrics: ["conversionRate", "referralCount"], defaultSort: { by: "conversionRate", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "member.most_received", title: "Most Business Received", category: "member", dataSource: "revenue",
    memberAxis: "receiver", dimensions: ["member"], metrics: ["revenue", "referralCount"], filters: DATE,
    defaultGroupBy: ["member"], defaultMetrics: ["revenue"], defaultSort: { by: "revenue", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "member.most_generated", title: "Most Business Generated", category: "member", dataSource: "revenue",
    memberAxis: "giver", dimensions: ["member"], metrics: ["revenue", "referralCount"], filters: DATE,
    defaultGroupBy: ["member"], defaultMetrics: ["revenue"], defaultSort: { by: "revenue", dir: "desc" }, defaultViz: "leaderboard",
  },
  {
    key: "member.referral_quality", title: "Referral Quality", category: "member", dataSource: "referrals",
    memberAxis: "receiver", dimensions: ["member"], metrics: ["conversionRate", "avgReferralValue", "referralCount"], filters: DATE,
    defaultGroupBy: ["member"], defaultMetrics: ["conversionRate", "avgReferralValue"], defaultSort: { by: "conversionRate", dir: "desc" }, defaultViz: "leaderboard",
  },
];

const OPP_FILTERS: ReportDefinition["filters"] = ["dateRange", "member", "opportunityStage"];

const FINANCIAL_REPORTS: ReportDefinition[] = [
  {
    key: "financial.pipeline_value", title: "Pipeline Value", category: "financial", dataSource: "opportunities",
    dimensions: ["opportunityStage", "member"], metrics: ["pipelineValue", "closedDeals"], filters: OPP_FILTERS,
    defaultGroupBy: ["opportunityStage"], defaultMetrics: ["pipelineValue"], defaultViz: "bar",
  },
  {
    key: "financial.closed_revenue", title: "Closed Revenue", category: "financial", dataSource: "opportunities",
    dimensions: ["member", "date"], metrics: ["revenue", "closedDeals"], filters: OPP_FILTERS,
    defaultMetrics: ["revenue"], defaultViz: "kpi",
  },
  {
    key: "financial.lost_revenue", title: "Lost Revenue", category: "financial", dataSource: "opportunities",
    dimensions: ["member", "date"], metrics: ["totalValue"], filters: OPP_FILTERS,
    defaultFilters: [{ field: "opportunityStage", op: "eq", value: "CLOSED_LOST" }],
    defaultMetrics: ["totalValue"], defaultViz: "kpi",
  },
  {
    key: "financial.forecast", title: "Revenue Forecast", category: "financial", dataSource: "opportunities",
    dimensions: ["member", "opportunityStage"], metrics: ["forecast", "pipelineValue"], filters: OPP_FILTERS,
    defaultMetrics: ["forecast"], defaultViz: "kpi",
  },
];

export const ALL_REPORTS: ReportDefinition[] = [
  ...REVENUE_REPORTS,
  ...REFERRAL_REPORTS,
  ...MEMBER_REPORTS,
  ...FINANCIAL_REPORTS,
];

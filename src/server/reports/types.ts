// Report Builder — core contracts. Everything the engine consumes is described
// by these types; adding a report type, dimension, metric, or data source means
// registering an object shaped like one of these, never editing the engine.

export type ReportCategory = "revenue" | "referral" | "member" | "financial";
export type DataSourceKey = "referrals" | "revenue" | "opportunities" | "members" | "activity";
export type DimensionKey =
  | "member" | "industry" | "date" | "referralStatus" | "opportunityStage" | "serviceCategory";
export type MetricKey =
  | "revenue" | "totalValue" | "referralCount" | "conversionRate"
  | "pipelineValue" | "closedDeals" | "avgReferralValue" | "acceptanceRate" | "forecast";
export type VizKey = "table" | "bar" | "line" | "pie" | "kpi" | "leaderboard";
export type FilterKey = "dateRange" | "member" | "industry" | "referralStatus" | "opportunityStage";
export type MemberAxis = "giver" | "receiver";
export type DateGranularity = "day" | "month";

// Derived from the Auth.js session. Role decides visibility; the engine never
// trusts client input for scope.
export type ReportContext = {
  userId: string;
  role: string; // UserRole string
  organizationId: string;
  isAdmin: boolean;
  memberAxis?: MemberAxis; // which side of a referral the "member" dimension groups on
  dateGranularity?: DateGranularity;
};

// The single normalized row shape every metric understands, so metrics stay
// pure and source-agnostic. Each data source maps its raw model rows into this.
export type MetricRow = {
  value: number; // valueEstimate / Deal.value, coerced from Decimal
  weight: number; // 0..1 (deal probability); 0 for sources without one
  won: boolean;
  lost: boolean;
  open: boolean; // neither won nor lost
  accepted: boolean; // referral taken up by the recipient
  giverId: string | null;
  receiverId: string | null;
  memberId: string | null; // single-sided sources set this directly
  industry: string | null;
  service: string | null;
  status: string | null; // LeadStatus
  stage: string | null; // DealStage
  date: Date | null;
};

export type FilterOp = "eq" | "in" | "gte" | "lte";
export type FilterInput = { field: FilterKey | string; op: FilterOp; value: unknown };
export type SortInput = { by: string; dir: "asc" | "desc" };
export type DateRangeInput = { from: string | Date; to: string | Date };

export type ReportRequest = {
  reportKey: string;
  dimensions?: DimensionKey[];
  metrics?: MetricKey[];
  filters?: FilterInput[];
  groupBy?: DimensionKey[];
  sortBy?: SortInput;
  dateRange?: DateRangeInput;
  viz?: VizKey;
};

export type PrismaModel = "lead" | "deal" | "user" | "activity";

export type DataSource = {
  key: DataSourceKey;
  model: PrismaModel;
  dateField: string; // the column the dateRange filters on
  baseWhere?: Record<string, unknown>;
  // THE ONLY place row visibility is decided. Always AND-ed into the query by
  // the engine; derived from ctx.role, never from client input.
  scope: (ctx: ReportContext) => Record<string, unknown>;
  // The exact columns `normalize` reads. Passed as the findMany `select` so the
  // engine pulls only those columns instead of every column of every matching
  // row — same aggregates, far less data over the wire and in memory. Must list
  // every field the source's `normalize` touches.
  select?: Record<string, true>;
  // Raw Prisma row -> shared MetricRow.
  normalize: (row: Record<string, unknown>) => MetricRow;
  // A builder filter -> a Prisma where fragment for THIS source (null = ignore).
  filterToWhere?: (f: FilterInput) => Record<string, unknown> | null;
};

export type Dimension = {
  key: DimensionKey;
  label: string;
  sources: DataSourceKey[];
  groupKey: (row: MetricRow, ctx: ReportContext) => string | number | null;
  formatKey?: (key: string | number | null) => string;
};

export type MetricFormat = "currency" | "number" | "percent";

export type Metric = {
  key: MetricKey;
  label: string;
  sources: DataSourceKey[];
  format: MetricFormat;
  dependsOn?: MetricKey[];
  // PURE: given the rows in one group, return the number. Unit-tested with fixtures.
  compute: (rows: MetricRow[], ctx: ReportContext) => number;
};

export type ReportDefinition = {
  key: string; // stable id, e.g. "revenue.by_member"
  title: string;
  category: ReportCategory;
  dataSource: DataSourceKey;
  dimensions: DimensionKey[]; // dimensions this report allows
  metrics: MetricKey[]; // metrics this report allows
  filters: FilterKey[];
  defaultFilters?: FilterInput[];
  defaultGroupBy?: DimensionKey[];
  defaultMetrics?: MetricKey[];
  defaultSort?: SortInput;
  defaultViz: VizKey;
  memberAxis?: MemberAxis; // giver for "generated", receiver for "received"
};

export type ReportColumn = {
  key: string;
  label: string;
  kind: "dimension" | "metric";
  format?: MetricFormat;
};
export type ReportResultRow = {
  dimensions: Record<string, string | number | null>;
  metrics: Record<string, number>;
};
export type ReportResult = {
  columns: ReportColumn[];
  rows: ReportResultRow[];
  meta: { lastUpdated: string; cached: boolean; scope: "org" | "self"; rowCount: number };
};

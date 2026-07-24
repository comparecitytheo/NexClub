import { prisma } from "@/lib/prisma";
import type {
  FilterInput,
  MetricRow,
  ReportColumn,
  ReportContext,
  ReportRequest,
  ReportResult,
  ReportResultRow,
} from "./types";
import { getDataSource, getDimension, getMetric, getReport } from "./registry";

// Model-agnostic Prisma access. The engine works over an opaque findMany so one
// code path serves every data source; the loose arg type is intentional.
type LooseDelegate = { findMany: (args: unknown) => Promise<Record<string, unknown>[]> };
const DELEGATE = {
  lead: () => prisma.lead,
  deal: () => prisma.deal,
  user: () => prisma.user,
  activity: () => prisma.activity,
} as const;
const delegateFor = (model: keyof typeof DELEGATE): LooseDelegate =>
  DELEGATE[model]() as unknown as LooseDelegate;

function dateFragment(field: string, range?: ReportRequest["dateRange"]): Record<string, unknown> {
  if (!range) return {};
  const from = range.from instanceof Date ? range.from : new Date(range.from);
  const to = range.to instanceof Date ? range.to : new Date(range.to);
  return { [field]: { gte: from, lte: to } };
}

const nonEmpty = (o: Record<string, unknown>) => o && Object.keys(o).length > 0;

function cmp(x: unknown, y: unknown): number {
  if (x == null) return 1;
  if (y == null) return -1;
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x).localeCompare(String(y));
}

// Compose base + permission scope + allowed filters + date window into one
// AND-ed where. Using AND avoids key collisions between fragments (e.g. a member
// scope's OR and a member filter's OR).
function buildWhere(
  source: NonNullable<ReturnType<typeof getDataSource>>,
  ctx: ReportContext,
  filters: FilterInput[],
  range?: ReportRequest["dateRange"],
): Record<string, unknown> {
  const fragments = [
    source.baseWhere ?? {},
    source.scope(ctx),
    ...filters
      .filter((f) => f.field !== "dateRange")
      .map((f) => source.filterToWhere?.(f))
      .filter((x): x is Record<string, unknown> => !!x),
    dateFragment(source.dateField, range),
  ].filter(nonEmpty);
  return { AND: fragments };
}

export async function runReport(req: ReportRequest, ctx: ReportContext): Promise<ReportResult> {
  const def = getReport(req.reportKey);
  if (!def) throw new Error(`Unknown report '${req.reportKey}'`);
  const source = getDataSource(def.dataSource);
  if (!source) throw new Error(`Unknown data source '${def.dataSource}'`);

  const rctx: ReportContext = { ...ctx, memberAxis: ctx.memberAxis ?? def.memberAxis ?? "receiver" };

  // Only filters the definition allows survive (defence in depth alongside the
  // scope); the date range is always permitted.
  const allowed = new Set<string>(def.filters);
  const filters: FilterInput[] = [
    ...(def.defaultFilters ?? []),
    ...(req.filters ?? []).filter((f) => f.field === "dateRange" || allowed.has(String(f.field))),
  ];

  const where = buildWhere(source, rctx, filters, req.dateRange);
  const rows = await delegateFor(source.model).findMany({ where });
  const norm: MetricRow[] = rows.map(source.normalize);

  const groupDims = (req.groupBy ?? def.defaultGroupBy ?? [])
    .map(getDimension)
    .filter((d): d is NonNullable<typeof d> => !!d);
  const metricDefs = (req.metrics ?? def.defaultMetrics ?? def.metrics)
    .map(getMetric)
    .filter((m): m is NonNullable<typeof m> => !!m);

  // Group by the composite of dimension keys. No dimensions => a single total row.
  const groups = new Map<string, { keys: (string | number | null)[]; rows: MetricRow[] }>();
  for (const r of norm) {
    const keys = groupDims.map((d) => d.groupKey(r, rctx));
    const gid = JSON.stringify(keys);
    let g = groups.get(gid);
    if (!g) {
      g = { keys, rows: [] };
      groups.set(gid, g);
    }
    g.rows.push(r);
  }
  if (groupDims.length === 0 && groups.size === 0) groups.set("[]", { keys: [], rows: [] });

  let resultRows: ReportResultRow[] = [...groups.values()].map((g) => ({
    dimensions: Object.fromEntries(groupDims.map((d, i) => [d.key, g.keys[i]])),
    metrics: Object.fromEntries(metricDefs.map((m) => [m.key, m.compute(g.rows, rctx)])),
  }));

  const sort = req.sortBy ?? def.defaultSort;
  if (sort) {
    const dir = sort.dir === "asc" ? 1 : -1;
    resultRows = resultRows.sort(
      (a, b) => dir * cmp(a.metrics[sort.by] ?? a.dimensions[sort.by], b.metrics[sort.by] ?? b.dimensions[sort.by]),
    );
  }

  const columns: ReportColumn[] = [
    ...groupDims.map((d) => ({ key: d.key, label: d.label, kind: "dimension" as const })),
    ...metricDefs.map((m) => ({ key: m.key, label: m.label, kind: "metric" as const, format: m.format })),
  ];

  return {
    columns,
    rows: resultRows,
    meta: {
      lastUpdated: new Date().toISOString(),
      cached: false,
      scope: rctx.isAdmin ? "org" : "self",
      rowCount: norm.length,
    },
  };
}

// Underlying records behind one aggregated cell: the same base + scope + filters
// plus the clicked cell's dimension values, so a drill-down can never surface a
// row the aggregate itself excluded.
export async function drillDown(
  req: ReportRequest,
  ctx: ReportContext,
  cell: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const def = getReport(req.reportKey);
  if (!def) throw new Error(`Unknown report '${req.reportKey}'`);
  const source = getDataSource(def.dataSource);
  if (!source) throw new Error(`Unknown data source '${def.dataSource}'`);
  const rctx: ReportContext = { ...ctx, memberAxis: ctx.memberAxis ?? def.memberAxis ?? "receiver" };

  const cellFilters: FilterInput[] = Object.entries(cell).map(([field, value]) => ({ field, op: "eq", value }));
  const where = buildWhere(source, rctx, cellFilters, req.dateRange);
  return delegateFor(source.model).findMany({ where, take: 500, orderBy: { [source.dateField]: "desc" } });
}

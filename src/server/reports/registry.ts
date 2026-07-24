import type {
  DataSource,
  DataSourceKey,
  Dimension,
  DimensionKey,
  Metric,
  MetricKey,
  ReportDefinition,
} from "./types";

// In-memory registries. Registering is the whole extension mechanism; the engine
// reads these and never imports the definitions directly.
const sources = new Map<string, DataSource>();
const dimensions = new Map<string, Dimension>();
const metrics = new Map<string, Metric>();
const reports = new Map<string, ReportDefinition>();

export function registerDataSource(ds: DataSource): void {
  sources.set(ds.key, ds);
}
export function registerDimension(d: Dimension): void {
  dimensions.set(d.key, d);
}
export function registerMetric(m: Metric): void {
  metrics.set(m.key, m);
}
export function registerReport(def: ReportDefinition): void {
  // Fail fast if a definition references something unregistered — keeps the
  // registry honest as report configs are added.
  if (!sources.has(def.dataSource)) throw new Error(`Report ${def.key}: unknown data source '${def.dataSource}'`);
  for (const d of def.dimensions) if (!dimensions.has(d)) throw new Error(`Report ${def.key}: unknown dimension '${d}'`);
  for (const m of def.metrics) if (!metrics.has(m)) throw new Error(`Report ${def.key}: unknown metric '${m}'`);
  reports.set(def.key, def);
}

export function getDataSource(k: DataSourceKey | string): DataSource | undefined {
  return sources.get(k);
}
export function getDimension(k: DimensionKey | string): Dimension | undefined {
  return dimensions.get(k);
}
export function getMetric(k: MetricKey | string): Metric | undefined {
  return metrics.get(k);
}
export function getReport(k: string): ReportDefinition | undefined {
  return reports.get(k);
}
export function listReports(): ReportDefinition[] {
  return [...reports.values()];
}
export function listDimensions(): Dimension[] {
  return [...dimensions.values()];
}
export function listMetrics(): Metric[] {
  return [...metrics.values()];
}

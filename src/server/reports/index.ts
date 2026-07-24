import { registerDataSource, registerDimension, registerMetric, registerReport } from "./registry";
import { SOURCES } from "./sources";
import { DIMENSIONS } from "./dimensions";
import { METRICS } from "./metrics";
import { ALL_REPORTS } from "./definitions";

// Importing this module registers everything. Guarded so repeated imports (and
// hot reload) don't double-register. Any consumer of the engine should import
// from "@/server/reports" so the registry is populated before a report runs.
let done = false;
export function registerAllReports(): void {
  if (done) return;
  SOURCES.forEach(registerDataSource);
  DIMENSIONS.forEach(registerDimension);
  METRICS.forEach(registerMetric);
  ALL_REPORTS.forEach(registerReport);
  done = true;
}

registerAllReports();

export { runReport, drillDown } from "./engine";
export {
  getReport,
  listReports,
  listDimensions,
  listMetrics,
} from "./registry";
export type {
  ReportDefinition,
  ReportRequest,
  ReportResult,
  ReportContext,
} from "./types";

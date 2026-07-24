import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin, tierOf, TIER_LABELS } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { LeadStageCards } from "@/components/dashboard/lead-stage-cards";
import { RangeKpiCards } from "@/components/dashboard/range-kpi-cards";
import { getLeadStageBreakdown, getRangeKpis } from "@/server/metrics";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { readRangeParams, resolveDateRange, RANGE_DAYS, DEFAULT_RANGE_DAYS } from "@/lib/date-range";

// Human label for the active range, shown on the revenue/conversion caption so
// it's obvious which window those cards reflect. Presets read "the last N days";
// a custom from/to reads as the formatted span.
function describeRange(
  p: { range?: string; from?: string; to?: string },
  r: { from: Date; to: Date },
): string {
  if (p.from && p.to) {
    const fmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt.format(r.from)} \u2014 ${fmt.format(r.to)}`;
  }
  const n = Number(p.range);
  const days = (RANGE_DAYS as readonly number[]).includes(n) ? n : DEFAULT_RANGE_DAYS;
  return `the last ${days} days`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  const admin = isAdmin(user.role);
  // Shared range control. It drives the revenue + conversion cards below (via
  // getRangeKpis) and the My Leads / Sent Leads boards. The lead-stage cards and
  // the per-role sections under them stay current-state by design.
  const rangeParams = readRangeParams(await searchParams);
  const range = resolveDateRange(rangeParams);
  // Fetched above the role split so every role gets the same scorecard: per-stage
  // lead totals (own business + club) and range-scoped revenue + conversion.
  const [leadStages, kpis] = await Promise.all([
    getLeadStageBreakdown(user.id, user.organizationId),
    getRangeKpis(user.id, user.organizationId, range),
  ]);
  const rangeLabel = describeRange(rangeParams, range);

  return (
    <div className="space-y-6 card-heading-accent">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 lg:pb-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Welcome, {user.name?.split(" ")[0] ?? "there"}</h1>
          <Badge variant="secondary">{TIER_LABELS[tierOf(user.role)]}</Badge>
          <span className="text-sm text-muted-foreground">{admin ? "Club overview" : "Your snapshot"}</span>
        </div>
        <DateRangePicker {...rangeParams} />
      </div>
      <LeadStageCards data={leadStages} />
      <RangeKpiCards data={kpis} rangeLabel={rangeLabel} />
      {admin ? (
        <AdminDashboard organizationId={user.organizationId} />
      ) : (
        <MemberDashboard userId={user.id} organizationId={user.organizationId} />
      )}
    </div>
  );
}

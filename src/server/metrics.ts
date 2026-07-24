import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, DEAL_STAGE_ORDER, DEAL_STAGE_LABELS, summariseLeadStages } from "@/lib/labels";
import { LEAD_STATUS_HEX, DEAL_STAGE_HEX } from "@/lib/chart-colors";

const CLOSED = ["CLOSED_WON", "CLOSED_LOST"] as const;

// Dashboard aggregates are read-heavy (getAdminMetrics alone runs 15 queries)
// and re-run on every dashboard navigation. Caching them for a short window
// removes almost all of that repeated Neon round-trip cost. 30s is well within
// tolerance for club-wide rollups. Only functions whose return value is plain
// JSON (numbers/strings — no Date objects) are cached here, because
// unstable_cache serializes results; getMemberMetrics returns Date-bearing
// rows (recentActivity/upcomingTasks) and is intentionally left uncached.
const DASHBOARD_REVALIDATE = 30;

export type ChartDatum = { label: string; value: number; color: string };

// Per-Kanban-stage lead breakdown for BOTH scopes, in one round-trip, for use
// by every role (the dashboard page calls this regardless of admin/member):
//   - individual: the viewer's own business (leads they own = the My Leads scope)
//   - club:       all businesses combined (the whole organization)
// Both use the same prisma.lead.groupBy(["status"]) the Kanban + metrics use, so
// each scope's stage counts always sum to that scope's total.
export const getLeadStageBreakdown = unstable_cache(
  async (userId: string, orgId: string) => {
    const [individualGroups, clubGroups] = await Promise.all([
      prisma.lead.groupBy({ by: ["status"], where: { organizationId: orgId, ownerId: userId }, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: { _all: true } }),
    ]);
    return {
      individual: summariseLeadStages(individualGroups.map((g) => ({ status: g.status, count: g._count._all }))),
      club: summariseLeadStages(clubGroups.map((g) => ({ status: g.status, count: g._count._all }))),
    };
  },
  ["dashboard:lead-stage-breakdown"],
  { revalidate: DASHBOARD_REVALIDATE, tags: ["dashboard-metrics"] },
);

export type ScopeKpi = { revenue: number; conversion: number; received: number; won: number };

// Revenue + lead-conversion for BOTH scopes, filtered to the selected date
// window. This is the ONE metrics call whose numbers move with the dashboard's
// date-range picker (the stage/summary calls above are current-state by design).
//   - individual: the viewer's own leads (ownerId = userId — the My Leads scope,
//     matching how the "Individual business" lead card is already scoped)
//   - club:       every business combined (the whole organization)
// The window filters on `dateReceived` (the business date a lead entered the
// club), so a card reads "of the leads received in this period, here's the
// revenue they've produced and what share converted" — an intake cohort, not
// "revenue booked in the period" (there is no separate won-date field to key
// that off). Revenue = sum of valueEstimate on won leads; conversion = won /
// received (lost leads stay in the denominator — they were still received).
export const getRangeKpis = unstable_cache(
  async (
    userId: string,
    orgId: string,
    range: { from: Date; to: Date },
  ): Promise<{ individual: ScopeKpi; club: ScopeKpi }> => {
  const window = { dateReceived: { gte: range.from, lte: range.to } };
  const indBase = { organizationId: orgId, ownerId: userId, ...window };
  const clubBase = { organizationId: orgId, ...window };

  const [indReceived, indWon, indRevAgg, clubReceived, clubWon, clubRevAgg] = await Promise.all([
    prisma.lead.count({ where: indBase }),
    prisma.lead.count({ where: { ...indBase, status: "CLOSED_WON" } }),
    prisma.lead.aggregate({ where: { ...indBase, status: "CLOSED_WON" }, _sum: { valueEstimate: true } }),
    prisma.lead.count({ where: clubBase }),
    prisma.lead.count({ where: { ...clubBase, status: "CLOSED_WON" } }),
    prisma.lead.aggregate({ where: { ...clubBase, status: "CLOSED_WON" }, _sum: { valueEstimate: true } }),
  ]);

  return {
    individual: {
      revenue: Number(indRevAgg._sum.valueEstimate ?? 0),
      conversion: indReceived > 0 ? indWon / indReceived : 0,
      received: indReceived,
      won: indWon,
    },
    club: {
      revenue: Number(clubRevAgg._sum.valueEstimate ?? 0),
      conversion: clubReceived > 0 ? clubWon / clubReceived : 0,
      received: clubReceived,
      won: clubWon,
    },
  };
  },
  ["dashboard:range-kpis"],
  { revalidate: DASHBOARD_REVALIDATE, tags: ["dashboard-metrics"] },
);

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const LIST_INCLUDE = {
  lead: { select: { id: true, contactName: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  deal: { select: { id: true, name: true } },
};

export async function getMemberMetrics(userId: string, orgId: string) {
  const leadBase = { organizationId: orgId, ownerId: userId };
  const dealBase = { organizationId: orgId, ownerId: userId };

  const [
    leadsReceived,
    leadsActive,
    leadsWon,
    leadRevenueAgg,
    leadStatusGroups,
    openDealAgg,
    wonDealAgg,
    dealStageGroups,
    tasksOpen,
    tasksOverdue,
    recentActivity,
    upcomingTasks,
  ] = await Promise.all([
    prisma.lead.count({ where: leadBase }),
    prisma.lead.count({ where: { ...leadBase, status: { notIn: [...CLOSED] } } }),
    prisma.lead.count({ where: { ...leadBase, status: "CLOSED_WON" } }),
    prisma.lead.aggregate({ where: { ...leadBase, status: "CLOSED_WON" }, _sum: { valueEstimate: true } }),
    prisma.lead.groupBy({ by: ["status"], where: leadBase, _count: { _all: true } }),
    prisma.deal.aggregate({ where: { ...dealBase, stage: { notIn: [...CLOSED] } }, _sum: { value: true }, _count: { _all: true } }),
    prisma.deal.aggregate({ where: { ...dealBase, stage: "CLOSED_WON" }, _sum: { value: true }, _count: { _all: true } }),
    prisma.deal.groupBy({ by: ["stage"], where: dealBase, _count: { _all: true }, _sum: { value: true } }),
    prisma.task.count({ where: { organizationId: orgId, assigneeId: userId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { organizationId: orgId, assigneeId: userId, status: { in: ["OPEN", "IN_PROGRESS"] }, dueDate: { lt: new Date() } } }),
    prisma.activity.findMany({ where: { organizationId: orgId, userId }, orderBy: { occurredAt: "desc" }, take: 6, include: { user: { select: { name: true } }, ...LIST_INCLUDE } }),
    prisma.task.findMany({ where: { organizationId: orgId, assigneeId: userId, status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { dueDate: "asc" }, take: 6, include: LIST_INCLUDE }),
  ]);

  const leadCountByStatus = new Map(leadStatusGroups.map((g) => [g.status, g._count._all]));
  const leadStatusData: ChartDatum[] = LEAD_STATUS_ORDER.map((s) => ({
    label: LEAD_STATUS_LABELS[s],
    value: leadCountByStatus.get(s) ?? 0,
    color: LEAD_STATUS_HEX[s],
  }));

  const dealValueByStage = new Map(dealStageGroups.map((g) => [g.stage, Number(g._sum.value ?? 0)]));
  const dealStageData: ChartDatum[] = DEAL_STAGE_ORDER.map((s) => ({
    label: DEAL_STAGE_LABELS[s],
    value: dealValueByStage.get(s) ?? 0,
    color: DEAL_STAGE_HEX[s],
  }));

  return {
    leadsReceived,
    leadsActive,
    leadsWon,
    leadRevenue: Number(leadRevenueAgg._sum.valueEstimate ?? 0),
    // Conversion rate = leads won / leads received. Received (the leads this
    // member owns) is the funnel input; won is the success output. Lost leads
    // stay in the denominator because they were still received — never sent.
    conversionRate: leadsReceived > 0 ? leadsWon / leadsReceived : 0,
    openDealsCount: openDealAgg._count._all,
    openDealsValue: Number(openDealAgg._sum.value ?? 0),
    wonDealsCount: wonDealAgg._count._all,
    wonDealsValue: Number(wonDealAgg._sum.value ?? 0),
    tasksOpen,
    tasksOverdue,
    leadStatusData,
    dealStageData,
    recentActivity,
    upcomingTasks,
  };
}

export const getAdminMetrics = unstable_cache(
  async (orgId: string) => {
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    membersCount,
    leadsTotal,
    leadsWon,
    leadRevenueAgg,
    leadStatusGroups,
    dealsTotal,
    openDealAgg,
    wonDealAgg,
    dealStageGroups,
    activityWindow,
    receivedByOwner,
    sentByReferrer,
    sentThisMonthByReferrer,
    wonByOwner,
    members,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.lead.count({ where: { organizationId: orgId } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "CLOSED_WON" } }),
    prisma.lead.aggregate({ where: { organizationId: orgId, status: "CLOSED_WON" }, _sum: { valueEstimate: true } }),
    prisma.lead.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: { _all: true } }),
    prisma.deal.count({ where: { organizationId: orgId } }),
    prisma.deal.aggregate({ where: { organizationId: orgId, stage: { notIn: [...CLOSED] } }, _sum: { value: true } }),
    prisma.deal.aggregate({ where: { organizationId: orgId, stage: "CLOSED_WON" }, _sum: { value: true }, _count: { _all: true } }),
    prisma.deal.groupBy({ by: ["stage"], where: { organizationId: orgId }, _count: { _all: true }, _sum: { value: true } }),
    prisma.activity.findMany({ where: { organizationId: orgId, occurredAt: { gte: since } }, select: { occurredAt: true } }),
    prisma.lead.groupBy({ by: ["ownerId"], where: { organizationId: orgId }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["referrerId"], where: { organizationId: orgId }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["referrerId"], where: { organizationId: orgId, dateReceived: { gte: monthStart } }, _count: { _all: true } }),
    prisma.deal.groupBy({ by: ["ownerId"], where: { organizationId: orgId, stage: "CLOSED_WON" }, _count: { _all: true }, _sum: { value: true } }),
    prisma.user.findMany({ where: { organizationId: orgId, isActive: true }, select: { id: true, name: true } }),
  ]);

  const leadCountByStatus = new Map(leadStatusGroups.map((g) => [g.status, g._count._all]));
  const leadStatusData: ChartDatum[] = LEAD_STATUS_ORDER.map((s) => ({
    label: LEAD_STATUS_LABELS[s],
    value: leadCountByStatus.get(s) ?? 0,
    color: LEAD_STATUS_HEX[s],
  }));

  const dealValueByStage = new Map(dealStageGroups.map((g) => [g.stage, Number(g._sum.value ?? 0)]));
  const dealStageData: ChartDatum[] = DEAL_STAGE_ORDER.map((s) => ({
    label: DEAL_STAGE_LABELS[s],
    value: dealValueByStage.get(s) ?? 0,
    color: DEAL_STAGE_HEX[s],
  }));

  const received = new Map(receivedByOwner.map((r) => [r.ownerId, r._count._all]));
  const sent = new Map(sentByReferrer.map((r) => [r.referrerId, r._count._all]));
  const sentMonth = new Map(sentThisMonthByReferrer.map((r) => [r.referrerId, r._count._all]));
  const wonValue = new Map(wonByOwner.map((r) => [r.ownerId, Number(r._sum.value ?? 0)]));
  const wonCount = new Map(wonByOwner.map((r) => [r.ownerId, r._count._all]));

  // Org-wide leads sent this month. NB: all-time leads sent always equals
  // leadsTotal (every lead has a member referrer, same reason leads received
  // equals leadsTotal — see conversionRate note below), so the all-time figure
  // would just mirror the card's headline. This month-scoped count is the
  // distinct, useful number, and matches the leaderboard's "this month" column.
  const leadsSentThisMonth = sentThisMonthByReferrer.reduce((s, r) => s + r._count._all, 0);

  const leaderboard = members
    .map((m) => ({
      id: m.id,
      name: m.name,
      received: received.get(m.id) ?? 0,
      sent: sent.get(m.id) ?? 0,
      sentThisMonth: sentMonth.get(m.id) ?? 0,
      wonValue: wonValue.get(m.id) ?? 0,
      wonCount: wonCount.get(m.id) ?? 0,
    }))
    .sort((a, b) => b.sentThisMonth - a.sentThisMonth || b.sent - a.sent || b.received - a.received)
    .slice(0, 8);

  // Activity volume over the last 14 days.
  const buckets: { label: string; value: number }[] = [];
  const idx = new Map<string, number>();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(start.getDate() - i);
    idx.set(dayKey(d), buckets.length);
    buckets.push({ label: new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short" }).format(d), value: 0 });
  }
  for (const a of activityWindow) {
    const i = idx.get(dayKey(a.occurredAt));
    if (i !== undefined) buckets[i].value++;
  }

  return {
    membersCount,
    leadsTotal,
    leadsWon,
    // Closed = every resolved lead (won + lost); Won = won only. Both derive from
    // the leadStatusGroups groupBy already fetched above — no extra query.
    leadsClosed: (leadCountByStatus.get("CLOSED_WON") ?? 0) + (leadCountByStatus.get("CLOSED_LOST") ?? 0),
    leadsSentThisMonth,
    leadRevenue: Number(leadRevenueAgg._sum.valueEstimate ?? 0),
    // Conversion rate = leads won / leads received (full funnel: received is the
    // input, won is the terminal success output; lost leads stay in the
    // denominator because they were still received). Org-wide every lead has an
    // owner (recipient), so leads received == leadsTotal — we divide by that,
    // NOT by leads sent.
    conversionRate: leadsTotal > 0 ? leadsWon / leadsTotal : 0,
    dealsTotal,
    pipelineValue: Number(openDealAgg._sum.value ?? 0),
    wonValue: Number(wonDealAgg._sum.value ?? 0),
    wonCount: wonDealAgg._count._all,
    leadStatusData,
    dealStageData,
    leaderboard,
    activityTrend: buckets,
  };
  },
  ["dashboard:admin-metrics"],
  { revalidate: DASHBOARD_REVALIDATE, tags: ["dashboard-metrics"] },
);

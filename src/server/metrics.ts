import { prisma } from "@/lib/prisma";
import { colleagueIdsFor } from "@/server/businesses";
// A deleted lead is a LOST lead: it came in, effort was spent on it, and it did
// not convert. So it counts everywhere activity is counted — totals, leads sent
// and received, conversion denominators — and folds into CLOSED_LOST wherever
// status is displayed. Won, revenue and active-pipeline queries filter on status
// and exclude it already, so no separate filter is needed.

import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, DEAL_STAGE_ORDER, DEAL_STAGE_LABELS, summariseLeadStages } from "@/lib/labels";
import { LEAD_STATUS_HEX, DEAL_STAGE_HEX } from "@/lib/chart-colors";

// Deal stages that are finished. DELETED is not a deal stage, so it is absent.
const CLOSED = ["CLOSED_WON", "CLOSED_LOST"] as const;

// Lead statuses that are finished. DELETED belongs here: a deleted lead is done
// with, so counting it as "active" overstated the open pipeline for the month
// before it is archived. Kept separate from CLOSED because the two enums differ.
const CLOSED_LEAD = ["CLOSED_WON", "CLOSED_LOST", "DELETED"] as const;

export type ChartDatum = { label: string; value: number; color: string };

// Per-Kanban-stage lead breakdown for BOTH scopes, in one round-trip, for use
// by every role (the dashboard page calls this regardless of admin/member):
//   - individual: the viewer's own business (leads they own = the My Leads scope)
//   - club:       all businesses combined (the whole organization)
// Both use the same prisma.lead.groupBy(["status"]) the Kanban + metrics use, so
// each scope's stage counts always sum to that scope's total.
export async function getLeadStageBreakdown(
  userId: string,
  orgId: string,
  /**
   * The dashboard's selected window. These cards previously ignored it and
   * always showed all-time totals, so changing the range moved the revenue
   * cards while the headline stage numbers sat still — which reads as the
   * picker being broken.
   */
  range?: { from: Date; to: Date }
) {
  // Leads are filtered on dateReceived — the date the lead actually came in,
  // which is what a backdated lead sets. Filtering on createdAt would put a
  // lead backdated to June into an "August" window because that is when it was
  // typed in.
  const inRange = range ? { dateReceived: { gte: range.from, lte: range.to } } : {};

  // "Individual business" means the viewer's BUSINESS, matching the label and
  // the rest of the CRM. It was scoped to the viewer alone, so a colleague's
  // leads were missing from a card that claims to cover the business.
  const team = await colleagueIdsFor(userId);
  const mine = team.length ? { in: team } : { in: [userId] };


  // Counts every lead handled in the period; the fold below moves DELETED into
  // the Lost column so the total still equals the sum of the columns.
  const [individualGroups, clubGroups] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: { organizationId: orgId, ownerId: mine, ...inRange }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["status"], where: { organizationId: orgId, ...inRange }, _count: { _all: true } }),
  ]);

  // A deleted lead is a lost lead: it came in and did not convert, whatever
  // stage it was at when it was removed. Folding DELETED into CLOSED_LOST keeps
  // it in the total and in the Lost column, and out of every other stage.
  const foldDeletedIntoLost = (groups: { status: string; _count: { _all: number } }[]) => {
    const rows: { status: string; count: number }[] = [];
    let lost = 0;
    for (const g of groups) {
      if (g.status === "DELETED" || g.status === "CLOSED_LOST") lost += g._count._all;
      else rows.push({ status: g.status, count: g._count._all });
    }
    if (lost > 0) rows.push({ status: "CLOSED_LOST", count: lost });
    return rows;
  };
  return {
    individual: summariseLeadStages(foldDeletedIntoLost(individualGroups) as never),
    club: summariseLeadStages(foldDeletedIntoLost(clubGroups) as never),
  };
}

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
export async function getRangeKpis(
  userId: string,
  orgId: string,
  range: { from: Date; to: Date },
): Promise<{ individual: ScopeKpi; club: ScopeKpi }> {
  const window = { dateReceived: { gte: range.from, lte: range.to } };
  // "Individual business" means the viewer's BUSINESS, matching the card label
  // and the stage cards beside it. Counting only the viewer left a colleague's
  // revenue out of a figure presented as the business's.
  const indTeam = await colleagueIdsFor(userId);
  const indOwner = indTeam.length ? { in: indTeam } : { in: [userId] };
  const indBase = { organizationId: orgId, ownerId: indOwner, ...window };
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
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const LIST_INCLUDE = {
  lead: { select: { id: true, contactName: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  deal: { select: { id: true, name: true } },
};

export async function getMemberMetrics(
  userId: string,
  orgId: string,
  range?: { from: Date; to: Date }
) {
  // The dashboard's date range now applies here too, so these counts move with
  // the picker instead of sitting at all-time totals beside cards that do.
  // Leads carry dateReceived (the business date, and what backdating sets);
  // deals have no equivalent, so they stay on createdAt.
  const leadRange = range ? { dateReceived: { gte: range.from, lte: range.to } } : {};
  const dealRange = range ? { createdAt: { gte: range.from, lte: range.to } } : {};
  const leadBase = { organizationId: orgId, ownerId: userId, ...leadRange };
  const dealBase = { organizationId: orgId, ownerId: userId, ...dealRange };

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
    prisma.lead.count({ where: { ...leadBase, status: { notIn: [...CLOSED_LEAD] } } }),
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

  // DELETED reads as Lost on the chart, matching the stage cards. Without this
  // the deleted leads would be fetched and then silently dropped, because the
  // chart only plots the five live statuses.
  const leadCountByStatus = new Map<string, number>();
  for (const g of leadStatusGroups) {
    const key = g.status === "DELETED" ? "CLOSED_LOST" : g.status;
    leadCountByStatus.set(key, (leadCountByStatus.get(key) ?? 0) + g._count._all);
  }
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

export async function getAdminMetrics(orgId: string, range?: { from: Date; to: Date }) {
  // The dashboard's date range. The 14-day activity chart and the "this month"
  // leaderboard column keep their own fixed windows on purpose — both say so in
  // their headings, so scoping them to the picker would contradict the label.
  // Leads on dateReceived (the business date), deals on createdAt — deals have
  // no received date.
  const leadRange = range ? { dateReceived: { gte: range.from, lte: range.to } } : {};
  const dealRange = range ? { createdAt: { gte: range.from, lte: range.to } } : {};

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
    prisma.lead.count({ where: { organizationId: orgId, ...leadRange } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "CLOSED_WON", ...leadRange } }),
    prisma.lead.aggregate({ where: { organizationId: orgId, status: "CLOSED_WON", ...leadRange }, _sum: { valueEstimate: true } }),
    prisma.lead.groupBy({ by: ["status"], where: { organizationId: orgId, ...leadRange }, _count: { _all: true } }),
    prisma.deal.count({ where: { organizationId: orgId, ...dealRange } }),
    prisma.deal.aggregate({ where: { organizationId: orgId, stage: { notIn: [...CLOSED] }, ...dealRange }, _sum: { value: true } }),
    prisma.deal.aggregate({ where: { organizationId: orgId, stage: "CLOSED_WON", ...dealRange }, _sum: { value: true }, _count: { _all: true } }),
    prisma.deal.groupBy({ by: ["stage"], where: { organizationId: orgId, ...dealRange }, _count: { _all: true }, _sum: { value: true } }),
    prisma.activity.findMany({ where: { organizationId: orgId, occurredAt: { gte: since } }, select: { occurredAt: true } }),
    prisma.lead.groupBy({ by: ["ownerId"], where: { organizationId: orgId, ...leadRange }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["referrerId"], where: { organizationId: orgId, ...leadRange }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["referrerId"], where: { organizationId: orgId, dateReceived: { gte: monthStart } }, _count: { _all: true } }),
    prisma.deal.groupBy({ by: ["ownerId"], where: { organizationId: orgId, ...dealRange, stage: "CLOSED_WON" }, _count: { _all: true }, _sum: { value: true } }),
    prisma.user.findMany({ where: { organizationId: orgId, isActive: true }, select: { id: true, name: true } }),
  ]);

  // DELETED reads as Lost on the chart, matching the stage cards. Without this
  // the deleted leads would be fetched and then silently dropped, because the
  // chart only plots the five live statuses.
  const leadCountByStatus = new Map<string, number>();
  for (const g of leadStatusGroups) {
    const key = g.status === "DELETED" ? "CLOSED_LOST" : g.status;
    leadCountByStatus.set(key, (leadCountByStatus.get(key) ?? 0) + g._count._all);
  }
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
}

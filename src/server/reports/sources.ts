import type { DataSource, FilterInput, MetricRow } from "./types";

const dec = (v: unknown): number => (v == null ? 0 : Number(v));
const asDate = (v: unknown): Date | null => (v instanceof Date ? v : v ? new Date(v as string) : null);
// A referral is "accepted" once the recipient engages with it (sender-side
// lifecycle). VIEWED is a look, not a commitment, so it does not count.
const ACCEPTED_SENT = new Set(["RESPONDED", "CONVERTED"]);

function leadRow(r: Record<string, unknown>): MetricRow {
  const raw = (r.status as string) ?? null;
  // A deleted lead is a lost lead: it came in and did not convert, whatever
  // stage it was at. Reading DELETED back as CLOSED_LOST puts it in the lost
  // metric and the conversion denominator, and keeps it out of open and won.
  const status = raw === "DELETED" ? "CLOSED_LOST" : raw;
  return {
    value: dec(r.valueEstimate),
    weight: 0,
    won: status === "CLOSED_WON",
    lost: status === "CLOSED_LOST",
    // A deleted lead is not open. Testing only for won/lost swept DELETED into
    // "open", inflating the open count for the month before a deleted lead is
    // archived out of reach.
    open: status !== "CLOSED_WON" && status !== "CLOSED_LOST" && status !== "DELETED",
    accepted: ACCEPTED_SENT.has((r.sentStatus as string) ?? ""),
    giverId: (r.referrerId as string) ?? null,
    receiverId: (r.ownerId as string) ?? null,
    memberId: null,
    industry:
      (r.industry as string) ||
      ((r.owner as { industry?: string | null } | undefined)?.industry ?? null),
    service: null,
    status,
    stage: null,
    date: asDate(r.dateReceived),
  };
}

function leadFilter(f: FilterInput): Record<string, unknown> | null {
  switch (f.field) {
    case "industry": return { industry: f.value };
    case "referralStatus": return { status: f.value };
    case "member": return { OR: [{ referrerId: f.value }, { ownerId: f.value }] };
    default: return null;
  }
}

// A member sees only referrals they gave OR received; an admin sees the org.
// This fragment is the whole permission boundary for referral/revenue data.
// The member ids in scope: a group when a business is selected, otherwise the
// one member. Kept in a helper so all four data sources agree.
function scopeIds(ctx: { userId: string; userIds?: string[] }): string[] {
  return ctx.userIds && ctx.userIds.length > 0 ? ctx.userIds : [ctx.userId];
}

const referralScope: DataSource["scope"] = (ctx) =>
  ctx.isAdmin
    ? { organizationId: ctx.organizationId }
    : {
        organizationId: ctx.organizationId,
        OR: [{ referrerId: { in: scopeIds(ctx) } }, { ownerId: { in: scopeIds(ctx) } }],
      };

const referrals: DataSource = {
  key: "referrals",
  model: "lead",
  // The industry dimension reads the owner's industry when the lead has none.
  include: { owner: { select: { industry: true } } },
  dateField: "dateReceived",
  // Deleted leads are excluded from every referral figure. `deletedAt` only
  // covers rows removed from the database; a lead deleted through the UI keeps
  // its row at status DELETED for a month before archiving, so without this it
  // kept counting toward referral totals and conversion.
  // Every referral, deleted included. A deleted lead is a referral that came in
  // and did not convert, so it belongs in the denominator of conversion and in
  // the referral count. It is classified as LOST below, never won or open, so
  // it drags conversion down rather than propping it up.
  baseWhere: { deletedAt: null },
  scope: referralScope,
  normalize: leadRow,
  filterToWhere: leadFilter,
};

// Revenue is won referrals — same model, pre-filtered to CLOSED_WON so revenue
// reports never have to remember the won filter.
const revenue: DataSource = {
  key: "revenue",
  model: "lead",
  // The industry dimension reads the owner's industry when the lead has none.
  include: { owner: { select: { industry: true } } },
  dateField: "dateReceived",
  baseWhere: { deletedAt: null, status: "CLOSED_WON" },
  scope: referralScope,
  normalize: leadRow,
  filterToWhere: leadFilter,
};

const opportunities: DataSource = {
  key: "opportunities",
  model: "deal",
  dateField: "createdAt",
  baseWhere: { deletedAt: null },
  scope: (ctx) =>
    ctx.isAdmin
      ? { organizationId: ctx.organizationId }
      : { organizationId: ctx.organizationId, ownerId: { in: scopeIds(ctx) } },
  normalize: (r) => {
    const stage = (r.stage as string) ?? null;
    return {
      value: dec(r.value),
      weight: dec(r.probability) / 100,
      won: stage === "CLOSED_WON",
      lost: stage === "CLOSED_LOST",
      open: stage !== "CLOSED_WON" && stage !== "CLOSED_LOST",
      accepted: false,
      giverId: null,
      receiverId: (r.ownerId as string) ?? null,
      memberId: (r.ownerId as string) ?? null,
      industry: null,
      service: null,
      status: null,
      stage,
      date: asDate(r.createdAt),
    };
  },
  filterToWhere: (f) => {
    switch (f.field) {
      case "opportunityStage": return { stage: f.value };
      case "member": return { ownerId: f.value };
      default: return null;
    }
  },
};

const members: DataSource = {
  key: "members",
  model: "user",
  dateField: "createdAt",
  baseWhere: { deletedAt: null },
  scope: (ctx) =>
    ctx.isAdmin
      ? { organizationId: ctx.organizationId }
      : { organizationId: ctx.organizationId, id: { in: scopeIds(ctx) } },
  normalize: (r) => ({
    value: 0,
    weight: 0,
    won: false,
    lost: false,
    open: false,
    accepted: false,
    giverId: (r.id as string) ?? null,
    receiverId: (r.id as string) ?? null,
    memberId: (r.id as string) ?? null,
    industry: (r.industry as string) ?? null,
    service: (r.services as string) ?? null,
    status: null,
    stage: null,
    date: asDate(r.createdAt),
  }),
  filterToWhere: (f) =>
    f.field === "industry" ? { industry: f.value } : f.field === "member" ? { id: f.value } : null,
};

const activity: DataSource = {
  key: "activity",
  model: "activity",
  dateField: "occurredAt",
  scope: (ctx) =>
    ctx.isAdmin
      ? { organizationId: ctx.organizationId }
      : { organizationId: ctx.organizationId, userId: { in: scopeIds(ctx) } },
  normalize: (r) => ({
    value: 0,
    weight: 0,
    won: false,
    lost: false,
    open: false,
    accepted: false,
    giverId: (r.userId as string) ?? null,
    receiverId: (r.userId as string) ?? null,
    memberId: (r.userId as string) ?? null,
    industry: null,
    service: null,
    status: null,
    stage: null,
    date: asDate(r.occurredAt),
  }),
  filterToWhere: (f) => (f.field === "member" ? { userId: f.value } : null),
};

export const SOURCES: DataSource[] = [referrals, revenue, opportunities, members, activity];

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { colleagueIdsFor } from "@/server/businesses";
import { isSuperAdmin } from "@/lib/rbac";
import { notify } from "@/server/notify";
import { requireUser, requireUserForWrite } from "@/server/api-helpers";
import { createLeadSchema, listLeadsSchema } from "@/server/validators/lead";
import { CONSENT_STATEMENT_VERSION } from "@/lib/consent";
import { recordAudit } from "@/server/audit";

const LEAD_INCLUDE = {
  owner: { select: { id: true, name: true, businessName: true, avatarUrl: true } },
  referrer: { select: { id: true, name: true, avatarUrl: true, businessName: true } },
  // Who performed the delete — shown on the Deleted tab, null elsewhere.
  deletedBy: { select: { name: true } },
} satisfies Prisma.LeadInclude;

export async function GET(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const { searchParams } = new URL(req.url);
  const parsed = listLeadsSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  const { view, q, from, to } = parsed.data;

  // Per-user scoping, enforced here on the data layer — never trust the client.
  // Nobody, admin included, can list leads that are not theirs. "all" means the
  // member's own leads in BOTH directions (received + sent), not the club's.
  const and: Prisma.LeadWhereInput[] = [{ organizationId: user.organizationId }];
  // BUSINESS-WIDE VISIBILITY, matching the server-rendered page exactly. If these
  // two ever disagree, the board shows one set of leads on load and a different
  // set after a refresh.
  // Mirrors the page exactly. `user` is already the effective member.
  const superAdmin = isSuperAdmin(user.role);
  // Everyone, including a Super Admin, gets their own business scope. A Super
  // Admin's club-wide sight is the separate "clubwide" view below.
  const team = await colleagueIdsFor(user.id);
  // Falls CLOSED, not open. `undefined` here would mean NO FILTER — the whole
  // club in a personal tab, which is exactly the leak that put other members'
  // leads in Received. colleagueIdsFor always returns at least the caller, so
  // this branch should be unreachable; it is written this way so that if that
  // ever changes the result is an empty list rather than everything.
  const who = { in: team.length ? team : [user.id] };

  // Received and Sent are BUSINESS views, matching the server-rendered page.
  // `who` is used throughout with no exemption: bypassing the filter yields
  // `undefined`, which is NO FILTER rather than "everything of mine" — that is
  // what leaked the whole club into personal tabs.

  const mine: Prisma.LeadWhereInput = { OR: [{ ownerId: who }, { referrerId: who }] };
  if (view === "received") and.push({ ownerId: who });
  else if (view === "sent") and.push({ referrerId: who });
  else if (view === "clubwide") {
    // Club wide: every lead in the club. Super Admin only — a member asking for
    // it gets their own business view instead, never a widened one.
    if (!superAdmin) and.push({ OR: [{ ownerId: who }, { referrerId: who }] });
  } else if (view === "deleted") {
    // Deleted leads. A member sees only the ones they deleted themselves; a
    // Super Admin sees every deleted lead in the club. `archivedAt: { not: null }`
    // is NOT applied here — passing an explicit archivedAt filter overrides the
    // extension's injected `archivedAt: null`, so this deliberately spans both
    // the current month's deletions and everything already archived.
    and.push({ status: "DELETED" });
    if (!superAdmin) and.push({ deletedById: who });
  } else and.push(mine); // "all" = everything of mine, both directions

  // The Deleted tab's dates are deletion dates, so the range filters on
  // `deletedOn` there and `createdAt` everywhere else.
  if (from && to) {
    const range = { gte: new Date(from), lte: new Date(to) };
    // dateReceived, matching the page: a backdated lead belongs to the window
    // it was received in, not the day it was entered.
    and.push(view === "deleted" ? { deletedOn: range } : { dateReceived: range });
  }

  if (q) {
    and.push({
      OR: [
        { contactName: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  // For the deleted view, pass `archivedAt` at the TOP level. The soft-delete
  // extension builds `{ archivedAt: null, ...where }`, so a caller-supplied
  // top-level value wins and archived leads become visible; nesting it inside
  // AND would NOT work, because the injected top-level filter still applies.
  const deletedView = view === "deleted";
  const items = await prisma.lead.findMany({
    where: deletedView ? { archivedAt: undefined, AND: and } : { AND: and },
    // Deleted is a record: most recently deleted first. Other views keep the
    // board ordering so drag positions are respected.
    orderBy: deletedView
      ? [{ deletedOn: "desc" }, { lastActivityAt: "desc" }]
      : [{ boardPosition: "asc" }, { lastActivityAt: "desc" }],
    include: LEAD_INCLUDE,
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  const parsed = createLeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { ownerId, followUpDate, valueEstimate, consentConfirmed, dateReceived, ...rest } = parsed.data;

  // A lead can be logged late but not early. Anything ahead of now collapses to
  // now rather than being rejected, so a clock skew on the client cannot fail
  // an otherwise valid referral.
  const now = new Date();
  const receivedAt = dateReceived && dateReceived < now ? dateReceived : now;

  const recipient = await prisma.user.findFirst({
    where: { id: ownerId, organizationId: user.organizationId, isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!recipient) return NextResponse.json({ error: "Recipient is not an active member of the club." }, { status: 400 });

  const lead = await prisma.lead.create({
    data: {
      ...rest,
      organizationId: user.organizationId,
      referrerId: user.id,
      ownerId,
      status: "NEW",
      valueEstimate: valueEstimate ?? null,
      followUpDate: followUpDate ?? null,
      boardPosition: 0,
      // Backdating: use the supplied date, or now. Clamped so a lead cannot be
      // received in the future — that would put it in a range nobody is looking
      // at yet and skew "this month" figures.
      dateReceived: receivedAt,
      lastActivityAt: new Date(),
      // Record WHAT the sender agreed to, not just that they agreed (APP 6).
      consentConfirmedAt: consentConfirmed ? new Date() : null,
      consentStatementVersion: consentConfirmed ? CONSENT_STATEMENT_VERSION : null,
    },
    include: LEAD_INCLUDE,
  });

  // Record the referral as an activity and notify the recipient.
  await prisma.activity.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      type: "NOTE",
      subject: `Lead referred to ${recipient.name}`,
      entityType: "LEAD",
      leadId: lead.id,
    },
  });
  if (recipient.id !== user.id) {
    await notify({
      organizationId: user.organizationId,
      recipientIds: [recipient.id],
      actorId: user.id,
      type: "LEAD_ASSIGNED",
      title: "New lead received",
      body: `${user.name} sent you a lead: ${lead.contactName}`,
      entityType: "LEAD",
      entityId: lead.id,
      email: { actorName: user.name, leadName: lead.contactName },
    });
  }
  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "ASSIGN", entityType: "Lead", entityId: lead.id, after: { ownerId } });

  return NextResponse.json(lead, { status: 201 });
}

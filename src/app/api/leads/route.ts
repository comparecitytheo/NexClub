import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notify";
import { requireUser } from "@/server/api-helpers";
import { isAdmin } from "@/lib/rbac";
import { createLeadSchema, listLeadsSchema } from "@/server/validators/lead";
import { CONSENT_STATEMENT_VERSION } from "@/lib/consent";
import { recordAudit } from "@/server/audit";

const LEAD_INCLUDE = {
  owner: { select: { id: true, name: true } },
  referrer: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.LeadInclude;

export async function GET(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const { searchParams } = new URL(req.url);
  const parsed = listLeadsSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  const { view, q } = parsed.data;
  const admin = isAdmin(user.role);

  const and: Prisma.LeadWhereInput[] = [{ organizationId: user.organizationId }];
  if (view === "received") and.push({ ownerId: user.id });
  else if (view === "sent") and.push({ referrerId: user.id });
  else if (!admin) and.push({ OR: [{ ownerId: user.id }, { referrerId: user.id }] });
  // admin + "all" → whole org, no extra filter

  if (q) {
    and.push({
      OR: [
        { contactName: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const items = await prisma.lead.findMany({
    where: { AND: and },
    orderBy: [{ boardPosition: "asc" }, { lastActivityAt: "desc" }],
    include: LEAD_INCLUDE,
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const parsed = createLeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { ownerId, followUpDate, valueEstimate, consentConfirmed, ...rest } = parsed.data;

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
      dateReceived: new Date(),
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

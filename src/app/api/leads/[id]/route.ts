import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notify";
import { requireUser } from "@/server/api-helpers";
import { isAdmin } from "@/lib/rbac";
import { updateLeadSchema } from "@/server/validators/lead";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

// A member can access a lead they sent or received; admins access any in the org.
function accessWhere(user: { id: string; organizationId: string; role: import("@prisma/client").UserRole }, id: string): Prisma.LeadWhereInput {
  return {
    id,
    organizationId: user.organizationId,
    ...(isAdmin(user.role) ? {} : { OR: [{ ownerId: user.id }, { referrerId: user.id }] }),
  };
}

export async function GET(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: accessWhere(a.user, id),
    include: {
      owner: { select: { id: true, name: true, email: true } },
      referrer: { select: { id: true, name: true, email: true } },
      activityEntries: {
        orderBy: { occurredAt: "desc" },
        take: 20,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const admin = isAdmin(user.role);

  const lead = await prisma.lead.findFirst({ where: accessWhere(user, id) });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const parsed = updateLeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { ownerId, followUpDate, valueEstimate, ...rest } = parsed.data;

  const canMutate = admin || lead.ownerId === user.id; // recipient works the lead
  const canReassign = admin || lead.referrerId === user.id; // sender can re-route
  const wantsReassign = ownerId !== undefined && ownerId !== lead.ownerId;
  const detailKeys = Object.keys(rest).filter((k) => (rest as Record<string, unknown>)[k] !== undefined);
  const wantsDetailEdit = detailKeys.length > 0 || followUpDate !== undefined || valueEstimate !== undefined;

  if (wantsDetailEdit && !canMutate) {
    return NextResponse.json({ error: "Only the recipient can edit this lead." }, { status: 403 });
  }
  if (wantsReassign && !canReassign) {
    return NextResponse.json({ error: "Only the sender or an admin can reassign this lead." }, { status: 403 });
  }

  const data: Prisma.LeadUpdateInput = { ...rest, lastActivityAt: new Date() };
  if (followUpDate !== undefined) data.followUpDate = followUpDate ?? null;
  if (valueEstimate !== undefined) data.valueEstimate = valueEstimate ?? null;

  let newRecipientName: string | null = null;
  if (wantsReassign && ownerId) {
    const recipient = await prisma.user.findFirst({
      where: { id: ownerId, organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true },
    });
    if (!recipient) return NextResponse.json({ error: "Recipient is not an active member." }, { status: 400 });
    data.owner = { connect: { id: ownerId } };
    data.boardPosition = 0;
    newRecipientName = recipient.name;
  }

  const updated = await prisma.lead.update({
    where: { id },
    data,
    include: { owner: { select: { id: true, name: true } }, referrer: { select: { id: true, name: true } } },
  });

  if (wantsReassign && ownerId && ownerId !== user.id) {
    await notify({
      organizationId: user.organizationId,
      recipientIds: [ownerId],
      actorId: user.id,
      type: "LEAD_ASSIGNED",
      title: "Lead reassigned to you",
      body: `${user.name} assigned you a lead: ${updated.contactName}`,
      entityType: "LEAD",
      entityId: id,
      email: { actorName: user.name, leadName: updated.contactName },
    });
    await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "ASSIGN", entityType: "Lead", entityId: id, before: { ownerId: lead.ownerId }, after: { ownerId } });
  } else {
    await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "Lead", entityId: id });
  }
  void newRecipientName;

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const admin = isAdmin(user.role);

  const lead = await prisma.lead.findFirst({ where: accessWhere(user, id) });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Only the sender (creator) or an admin can delete a referral.
  if (!admin && lead.referrerId !== user.id) {
    return NextResponse.json({ error: "Only the sender or an admin can delete this lead." }, { status: 403 });
  }

  await prisma.lead.softDelete({ id });
  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "DELETE", entityType: "Lead", entityId: id });
  return NextResponse.json({ ok: true });
}

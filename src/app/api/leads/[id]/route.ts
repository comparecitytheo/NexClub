import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { leadAccessWhere } from "@/server/businesses";
import { notify } from "@/server/notify";
import { requireUser, requireUserForWrite } from "@/server/api-helpers";
import { isAdminOrAbove, isSuperAdmin } from "@/lib/rbac";
import { updateLeadSchema } from "@/server/validators/lead";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

// A member can access a lead they sent or received; admins access any in the org.
/**
 * Business-scoped for every role. This was `isAdmin ? {} : ...`, and isAdminOrAbove()
 * is true for a business Admin as well as a Super Admin — so the empty fragment
 * let an Admin open any lead in the club by id. That was the cross-business leak.
 *
 * @param clubWide READS pass isSuperAdmin, so a Super Admin can open anything the
 *                 Club wide board shows them. WRITES pass false: editing or
 *                 deleting another business's lead is never allowed, matching the
 *                 Club wide board being read-only.
 */
async function accessWhere(
  user: { id: string; organizationId: string; role: import("@prisma/client").UserRole },
  id: string,
  clubWide: boolean
): Promise<Prisma.LeadWhereInput> {
  return {
    id,
    organizationId: user.organizationId,
    ...(await leadAccessWhere(user.id, clubWide)),
  };
}

export async function GET(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: await accessWhere(a.user, id, isSuperAdmin(a.user.role)),
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
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const admin = isAdminOrAbove(user.role);

  const lead = await prisma.lead.findFirst({ where: await accessWhere(user, id, false) });
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
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const admin = isAdminOrAbove(user.role);

  const lead = await prisma.lead.findFirst({ where: await accessWhere(user, id, false) });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Only the sender (creator) or an admin can delete a referral.
  if (!admin && lead.referrerId !== user.id) {
    return NextResponse.json({ error: "Only the sender or an admin can delete this lead." }, { status: 403 });
  }

  // Leads are never removed. Deleting is a state transition on `status` — no
  // separate deleted flag, and deliberately NOT a soft delete: `deletedAt` stays
  // untouched so the lead remains visible to admins until the monthly archival
  // job moves it out of sight. The rest is metadata for the archive export.
  //
  // Everything hanging off the lead goes with it, in one transaction so a lead
  // can never end up flagged deleted while its tasks are still live.
  //
  // Tasks are SOFT deleted: they leave every screen while the rows stay for
  // reporting — the same treatment the lead itself gets, and the reason the
  // lead row is only status-flipped rather than removed.
  //
  // Notifications are HARD deleted. They are a transient inbox, carry no
  // reporting value, and leaving them behind means members keep clicking
  // through to a lead that is no longer there.
  const { tasksRemoved, notificationsRemoved } = await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id },
      data: {
        status: "DELETED",
        statusBeforeDelete: lead.status,
        deletedOn: new Date(),
        deletedById: user.id,
      },
    });
    const tasks = (await tx.task.softDeleteMany({ leadId: id, deletedAt: null })) as {
      count: number;
    };
    const notifications = await tx.notification.deleteMany({
      where: { entityType: "LEAD", entityId: id },
    });
    return { tasksRemoved: tasks.count, notificationsRemoved: notifications.count };
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "DELETE",
    entityType: "Lead",
    entityId: id,
    before: { status: lead.status },
    after: {
      status: "DELETED",
      tasksRemoved,
      notificationsRemoved,
    },
  });
  return NextResponse.json({ ok: true });
}

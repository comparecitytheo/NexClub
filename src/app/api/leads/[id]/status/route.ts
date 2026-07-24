import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notify";
import { requireUser } from "@/server/api-helpers";
import { isAdmin } from "@/lib/rbac";
import { moveLeadSchema } from "@/server/validators/lead";
import { recordAudit } from "@/server/audit";
import { LEAD_STATUS_LABELS } from "@/lib/labels";

type Params = { params: Promise<{ id: string }> };

// Only the recipient (owner) or an admin can move a lead through the pipeline.
export async function PATCH(req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: user.organizationId, ...(isAdmin(user.role) ? {} : { ownerId: user.id }) },
    include: { referrer: { select: { id: true, name: true, email: true } } },
  });
  if (!lead) return NextResponse.json({ error: "You can only move leads assigned to you." }, { status: 403 });

  const parsed = moveLeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { status, boardPosition, fromStatus } = parsed.data;

  // Optimistic concurrency: when the client tells us the stage it moved FROM,
  // apply the move only while the lead is still in that stage. If another
  // receiver already moved it, return 409 with the current stage so the client
  // can reconcile (revert + re-sync) instead of silently clobbering their move.
  if (fromStatus) {
    const moved = await prisma.lead.updateMany({
      where: { id, organizationId: user.organizationId, status: fromStatus },
      data: { status, boardPosition, lastActivityAt: new Date() },
    });
    if (moved.count === 0) {
      const fresh = await prisma.lead.findUnique({ where: { id }, select: { status: true, boardPosition: true } });
      return NextResponse.json(
        { error: "This lead was just moved by someone else.", currentStatus: fresh?.status ?? lead.status },
        { status: 409 }
      );
    }
  } else {
    await prisma.lead.update({
      where: { id },
      data: { status, boardPosition, lastActivityAt: new Date() },
    });
  }

  const before = fromStatus ?? lead.status;
  const changed = status !== before;

  if (changed) {
    await prisma.activity.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        type: "NOTE",
        subject: `Lead moved to ${LEAD_STATUS_LABELS[status]}`,
        entityType: "LEAD",
        leadId: id,
      },
    });
    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "STATUS_CHANGE",
      entityType: "Lead",
      entityId: id,
      before: { status: before },
      after: { status },
    });

    // Notify the sender (referrer) that the lead they referred advanced a stage.
    // This is what surfaces in their bell in near-real-time and deep-links to the lead.
    if (lead.referrerId !== user.id) {
      await notify({
        organizationId: user.organizationId,
        recipientIds: [lead.referrerId],
        actorId: user.id,
        type: "LEAD_STATUS_CHANGE",
        title: `Lead update: ${lead.contactName}`,
        body: `${user.name} moved your lead to ${LEAD_STATUS_LABELS[status]}.`,
        entityType: "LEAD",
        entityId: id,
        email: {
          actorName: user.name,
          leadName: lead.contactName,
          fromStage: LEAD_STATUS_LABELS[before],
          toStage: LEAD_STATUS_LABELS[status],
        },
      });
    }
  }

  return NextResponse.json({ id, status, boardPosition });
}

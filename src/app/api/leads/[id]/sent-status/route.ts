import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { isAdmin } from "@/lib/rbac";
import { moveSentLeadSchema } from "@/server/validators/lead";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

// Only the sender (referrer) or an admin can move a lead through the sent lifecycle.
// This is independent of the recipient's pipeline (LeadStatus), which only the
// recipient can change via /api/leads/[id]/status.
export async function PATCH(req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: user.organizationId, ...(isAdmin(user.role) ? {} : { referrerId: user.id }) },
  });
  if (!lead) return NextResponse.json({ error: "You can only move leads you sent." }, { status: 403 });

  const parsed = moveSentLeadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { sentStatus } = parsed.data;

  const updated = await prisma.lead.update({
    where: { id },
    data: { sentStatus, lastActivityAt: new Date() },
    select: { id: true, sentStatus: true },
  });

  if (sentStatus !== lead.sentStatus) {
    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "STATUS_CHANGE",
      entityType: "Lead",
      entityId: id,
      before: { sentStatus: lead.sentStatus },
      after: { sentStatus },
    });
  }

  return NextResponse.json(updated);
}

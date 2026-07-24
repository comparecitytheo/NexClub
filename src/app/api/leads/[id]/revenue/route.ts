import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { isAdmin } from "@/lib/rbac";
import { leadRevenueSchema } from "@/server/validators/lead";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

// Records the lead's value. This is what feeds "Revenue generated" once the
// recipient marks the lead Closed / Won. It does not affect any pipeline value.
export async function PATCH(req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const admin = isAdmin(user.role);

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: user.organizationId, ...(admin ? {} : { OR: [{ referrerId: user.id }, { ownerId: user.id }] }) },
    select: { id: true, valueEstimate: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = leadRevenueSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.lead.update({
    where: { id },
    data: { valueEstimate: parsed.data.valueEstimate ?? null, lastActivityAt: new Date() },
    select: { id: true, valueEstimate: true },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "Lead",
    entityId: id,
    before: { valueEstimate: lead.valueEstimate == null ? null : Number(lead.valueEstimate) },
    after: { valueEstimate: updated.valueEstimate == null ? null : Number(updated.valueEstimate) },
  });

  return NextResponse.json({ valueEstimate: updated.valueEstimate == null ? null : Number(updated.valueEstimate) });
}

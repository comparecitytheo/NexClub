import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/server/api-helpers";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { mapInvitation } from "@/server/invitations";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;
  const ctx = getClientContext(req);
  const { id } = await params;

  const inv = await prisma.invitation.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true, status: true } });
  if (!inv) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  if (inv.status === "ACCEPTED") return NextResponse.json({ error: "This invitation was already accepted." }, { status: 409 });

  const updated = await prisma.invitation.update({ where: { id }, data: { status: "REVOKED" } });
  await recordAudit({
    organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "Invitation",
    entityId: id, after: { status: "REVOKED" }, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
  });
  return NextResponse.json({ invitation: mapInvitation(updated) });
}

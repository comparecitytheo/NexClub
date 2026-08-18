import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminForWrite } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

/**
 * Deleting a saved report removes the definition only. Nothing is cached, so no
 * figures are lost — the same metrics can be rebuilt and re-run at any time.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  // Scoped to the caller's organisation, so an id from elsewhere cannot delete
  // another club's report.
  const existing = await prisma.savedReport.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, name: true, metricKeys: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  await prisma.savedReport.delete({ where: { id } });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "DELETE",
    entityType: "SAVED_REPORT",
    entityId: id,
    before: { name: existing.name, metricKeys: existing.metricKeys },
  });

  return NextResponse.json({ ok: true });
}

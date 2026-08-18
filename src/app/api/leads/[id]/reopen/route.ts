import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { colleagueIdsFor } from "@/server/businesses";
import { requireUserForWrite } from "@/server/api-helpers";
import { isAdminOrAbove, isSuperAdmin } from "@/lib/rbac";
import { recordAudit } from "@/server/audit";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * Reopen a deleted lead.
 *
 * Puts the lead back into the stage it held before deletion and clears the whole
 * deletion trail, including `archivedAt` — so a lead that had already been swept
 * into the archive returns to the live pipeline and leaves the Deleted tab.
 *
 * Permission mirrors deletion exactly: the member who sent the referral, or an
 * admin. A receiver cannot reopen a lead they were never allowed to delete.
 */
export async function POST(_req: Request, { params }: Params) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const admin = isAdminOrAbove(user.role);

  // `archivedAt: undefined` overrides the extension's injected `archivedAt: null`,
  // which is the only way to reach an already-archived lead.
  const lead = await prisma.lead.findFirst({
    where: { archivedAt: undefined, id, organizationId: user.organizationId },
    select: { id: true, status: true, statusBeforeDelete: true, referrerId: true, ownerId: true, contactName: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (lead.status !== "DELETED") {
    return NextResponse.json({ error: "This lead is not deleted." }, { status: 400 });
  }
  // Anyone at the business that sent or received this lead may reopen it, which
  // matches what the board now shows them. Previously only the individual sender
  // could, so a colleague saw the lead and the Reopen button but got a 403.
  const team = await colleagueIdsFor(user.id);
  const mine = team.includes(lead.referrerId) || team.includes(lead.ownerId);
  if (!isSuperAdmin(user.role) && !mine) {
    return NextResponse.json(
      { error: "Only someone at the business that handled this lead can reopen it." },
      { status: 403 }
    );
  }

  // Fall back to NEW if the stage was never recorded (leads deleted before the
  // trail existed), so a reopen can never leave the lead in a dead state.
  const restored = lead.statusBeforeDelete ?? "NEW";

  await prisma.lead.update({
    where: { id },
    data: {
      status: restored,
      statusBeforeDelete: null,
      deletedOn: null,
      deletedById: null,
      archivedAt: null,
      // Back at the top of its column rather than wherever it used to sit.
      boardPosition: 0,
      lastActivityAt: new Date(),
    },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "Lead",
    entityId: id,
    before: { status: "DELETED" },
    after: { status: restored, reopened: true },
  });

  return NextResponse.json({ ok: true, status: restored });
}

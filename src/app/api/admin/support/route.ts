import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireUser } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";
import { getClientContext } from "@/server/request";
import { startSupportSession, endSupportSession, readSupportSession } from "@/server/support-session";

export const runtime = "nodejs";

/**
 * Start helping a member. Super Admin only, and audited at both ends — starting
 * and stopping are themselves recorded, so the log shows exactly when the
 * operator had access and to whose account.
 */
export async function POST(req: Request) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;
  const ctx = getClientContext(req);

  const body = await req.json().catch(() => null);
  const targetUserId = typeof body?.userId === "string" ? body.userId : null;
  if (!targetUserId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  // Never allow support mode onto another Super Admin: that would be one
  // operator acting as another, which the audit trail cannot meaningfully
  // distinguish afterwards.
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, organizationId: user.organizationId, isActive: true },
    select: { id: true, name: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "You cannot use support mode on another Super Admin." },
      { status: 400 }
    );
  }
  if (target.id === user.id) {
    return NextResponse.json({ error: "You are already yourself." }, { status: 400 });
  }

  await startSupportSession(user.id, target.id);
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "SupportSession",
    entityId: target.id,
    after: { startedSupportFor: target.name, targetUserId: target.id },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return NextResponse.json({ ok: true, targetName: target.name });
}

/** Stop helping and return to your own account. */
export async function DELETE(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const ctx = getClientContext(req);

  const active = await readSupportSession(user.id);
  await endSupportSession();

  if (active) {
    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "SupportSession",
      entityId: active.targetUserId,
      after: { endedSupportFor: active.targetName },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  return NextResponse.json({ ok: true });
}

import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireSuperAdminForWrite } from "@/server/api-helpers";
import { canManageRole } from "@/lib/rbac";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { lastAdminBlocker } from "@/server/businesses";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const target = await prisma.user.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      businessName: true, industry: true, phone: true, avatarUrl: true,
      emailVerified: true, createdAt: true, hashedPassword: true,
    },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Activity summary — counts across the CRM entities the member touches.
  const [ownedLeads, referredLeads, ownedDeals, assignedTasks, createdTasks, recent] = await prisma.$transaction([
    prisma.lead.count({ where: { organizationId: user.organizationId, ownerId: id } }),
    prisma.lead.count({ where: { organizationId: user.organizationId, referrerId: id } }),
    prisma.deal.count({ where: { organizationId: user.organizationId, ownerId: id } }),
    prisma.task.count({ where: { organizationId: user.organizationId, assigneeId: id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.task.count({ where: { organizationId: user.organizationId, creatorId: id } }),
    prisma.auditLog.findMany({
      where: { organizationId: user.organizationId, actorId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, entityType: true, entityId: true, createdAt: true },
    }),
  ]);

  const { hashedPassword, createdAt, ...profile } = target;
  return NextResponse.json({
    profile: { ...profile, createdAt: createdAt.toISOString(), pendingSetup: hashedPassword === null },
    activity: {
      ownedLeads, referredLeads, ownedDeals, openTasks: assignedTasks, createdTasks,
      recent: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    },
  });
}

export async function DELETE(req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const ctx = getClientContext(req);

  // Sensitive action -> require explicit confirmation from the client.
  const confirmed = new URL(req.url).searchParams.get("confirm") === "true";
  if (!confirmed) return NextResponse.json({ error: "Confirmation required." }, { status: 400 });

  if (id === user.id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });

  const target = await prisma.user.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!canManageRole(user.role, target.role)) {
    return NextResponse.json({ error: "You do not have permission to remove this member." }, { status: 403 });
  }

  // Never delete the last Super Admin.
  if (target.role === "SUPER_ADMIN") {
    const supers = await prisma.user.count({ where: { organizationId: user.organizationId, role: "SUPER_ADMIN" } });
    if (supers <= 1) return NextResponse.json({ error: "You cannot delete the last Super Admin." }, { status: 400 });
  }

  // Never leave a business without an admin.
  const blocker = await lastAdminBlocker(id);
  if (blocker) return NextResponse.json({ error: blocker }, { status: 400 });

  await prisma.user.softDelete({ id });
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "DELETE",
    entityType: "User",
    entityId: id,
    before: { email: target.email, role: target.role },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return NextResponse.json({ ok: true });
}


/**
 * Rename a member. Super Admin only.
 *
 * Members can already rename themselves from profile settings; this is for the
 * cases they cannot handle — a typo at signup, a legal name change, or an
 * account set up on someone's behalf.
 */
export async function PATCH(req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const parsed = renameUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, name: true },
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await prisma.user.update({ where: { id }, data: { name: parsed.data.name } });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: id,
    before: { name: target.name },
    after: { name: parsed.data.name },
  });

  return NextResponse.json({ ok: true, name: parsed.data.name });
}

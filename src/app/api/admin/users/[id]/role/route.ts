import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lastAdminBlocker } from "@/server/businesses";
import { requireSuperAdminForWrite } from "@/server/api-helpers";
import { canManageRole } from "@/lib/rbac";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { wouldRemoveLastSuperAdmin } from "@/server/admin/roles";
import { changeRoleSchema } from "@/server/validators/admin";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const ctx = getClientContext(req);

  const parsed = changeRoleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { role: newRole } = parsed.data;

  const target = await prisma.user.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!canManageRole(user.role, target.role) || !canManageRole(user.role, newRole)) {
    return NextResponse.json({ error: "You do not have permission to assign that role." }, { status: 403 });
  }
  if (target.role === newRole) return NextResponse.json({ error: "That is already this member's role." }, { status: 400 });

  // Last-Super-Admin protection — also blocks a Super Admin demoting themselves
  // when they are the only active one. Count active super admins (an inactive one
  // can't sign in, so it doesn't count toward avoiding a lockout).
  // DOOR 3 of 3: demoting the only admin of a business is the same lockout as
  // deleting or deactivating them.
  if (target.role === "ADMIN" && newRole !== "ADMIN") {
    const blocker = await lastAdminBlocker(id);
    if (blocker) return NextResponse.json({ error: blocker }, { status: 400 });
  }

  if (target.role === "SUPER_ADMIN" && newRole !== "SUPER_ADMIN") {
    const superAdminCount = await prisma.user.count({
      where: { organizationId: user.organizationId, role: "SUPER_ADMIN", isActive: true },
    });
    if (wouldRemoveLastSuperAdmin({ targetCurrentRole: target.role, newRole, superAdminCount })) {
      return NextResponse.json({ error: "You cannot remove the last Super Admin." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({ where: { id }, data: { role: newRole }, select: { id: true, name: true, role: true } });
  await recordAudit({
    organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "User", entityId: id,
    before: { role: target.role }, after: { role: newRole }, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
  });
  return NextResponse.json(updated);
}

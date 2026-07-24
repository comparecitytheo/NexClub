import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/server/api-helpers";
import { canManageRole } from "@/lib/rbac";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { changeStatusSchema } from "@/server/validators/admin";

type Params = { params: Promise<{ id: string }> };

// Activate / deactivate (suspend). A deactivated user fails the auth check
// (see auth.ts: `!user.isActive` blocks sign-in), so this takes effect at login.
export async function PATCH(req: Request, { params }: Params) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;
  const ctx = getClientContext(req);

  const parsed = changeStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { isActive } = parsed.data;

  const target = await prisma.user.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!canManageRole(user.role, target.role)) {
    return NextResponse.json({ error: "You do not have permission to manage this member." }, { status: 403 });
  }

  if (!isActive) {
    if (target.id === user.id) return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    // Don't lock everyone out by suspending the last active Super Admin.
    if (target.role === "SUPER_ADMIN") {
      const otherActive = await prisma.user.count({
        where: { organizationId: user.organizationId, role: "SUPER_ADMIN", isActive: true, id: { not: id } },
      });
      if (otherActive === 0) return NextResponse.json({ error: "You cannot deactivate the last Super Admin." }, { status: 400 });
    }
  }

  if (target.isActive === isActive) return NextResponse.json({ error: "No change." }, { status: 400 });

  const updated = await prisma.user.update({ where: { id }, data: { isActive }, select: { id: true, name: true, isActive: true } });
  await recordAudit({
    organizationId: user.organizationId, actorId: user.id, action: "STATUS_CHANGE", entityType: "User", entityId: id,
    before: { isActive: target.isActive }, after: { isActive }, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent,
  });
  return NextResponse.json(updated);
}

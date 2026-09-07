import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminForWrite } from "@/server/api-helpers";
import { canManageRole, isSuperAdmin } from "@/lib/rbac";
import { lastAdminBlocker } from "@/server/businesses";
import { updateUserSchema } from "@/server/validators/user";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const a = await requireAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const target = await prisma.user.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Tier enforcement: you may only act on a user whose tier you manage, and only
  // assign a role at a tier you manage. This stops an Admin touching a Super
  // Admin, or escalating anyone (themselves included) past their own tier.
  if (!canManageRole(user.role, target.role)) {
    return NextResponse.json({ error: "You do not have permission to manage this member." }, { status: 403 });
  }
  if (parsed.data.role !== undefined && !canManageRole(user.role, parsed.data.role)) {
    return NextResponse.json({ error: "You do not have permission to assign that role." }, { status: 403 });
  }

  if (target.id === user.id && parsed.data.isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, isActive: true, businessName: true, industry: true, phone: true, avatarUrl: true },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: id,
    before: { role: target.role, isActive: target.isActive },
    after: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const a = await requireAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  if (id === user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!canManageRole(user.role, target.role)) {
    return NextResponse.json({ error: "You do not have permission to remove this member." }, { status: 403 });
  }

  // The same last-admin check the Admin screen runs. It was missing here, so
  // the guard could be walked around simply by removing the member from the
  // Members tab instead — two doors to the same lockout, which is exactly what
  // putting the rule in one function was meant to prevent.
  //
  // A Super Admin is exempt: the block exists so a business is never left with
  // nobody who can manage it, and a Super Admin can always manage it. Without
  // the exemption the club cannot remove anyone at all — 14 of its 16
  // businesses have exactly one admin.
  if (!isSuperAdmin(user.role)) {
    const blocker = await lastAdminBlocker(id);
    if (blocker) return NextResponse.json({ error: blocker }, { status: 400 });
  }

  await prisma.user.softDelete({ id });
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "DELETE",
    entityType: "User",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}

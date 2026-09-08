import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireSuperAdminForWrite } from "@/server/api-helpers";
import { canManageRole, isSuperAdmin } from "@/lib/rbac";
import { getClientContext } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { businessIfNowEmpty, lastAdminBlocker } from "@/server/businesses";
import { renameUserSchema } from "@/server/validators/user";

type Params = { params: Promise<{ id: string }> };

/**
 * What a Super Admin may change on someone else's profile.
 *
 * Deliberately the SAME fields a member can edit themselves (see
 * updateProfileSchema), plus `name`, which members can no longer change.
 * Keeping the two lists aligned means "fix my listing for me" works without
 * granting anything beyond what the member already controls.
 *
 * Not here on purpose: role, active status and business membership. Those have
 * their own endpoints with their own guards — the last-admin check in
 * particular — and folding them in here would route around those.
 */
const adminEditProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(160).optional(),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  services: z.string().trim().max(2000).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function GET(_req: Request, { params }: Params) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const target = await prisma.user.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      services: true, bio: true,
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

  // Never leave a business without an admin — unless the person doing the
  // removing is a Super Admin, who can manage that business regardless. The
  // club has one admin at 14 of its 16 businesses, so without the exemption
  // this endpoint refuses to remove almost anybody.
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
    before: { email: target.email, role: target.role },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  // Same offer as the Members tab makes: if that emptied the business, tell the
  // caller so it can ask whether to delete it too.
  const orphanedBusiness = await businessIfNowEmpty(target.businessId);

  return NextResponse.json({ ok: true, orphanedBusiness });
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

  const parsed = adminEditProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, name: true, industry: true, services: true, phone: true, bio: true },
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Only the fields actually sent are written, so a form that edits one field
  // cannot blank the rest. Empty string means "clear this", which is how the
  // member's own profile form behaves.
  const data: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    data[key] = key === "name" ? String(value) : value === "" ? null : String(value);
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: id,
    // The audit is the member's protection here: edits are silent to them, so
    // the trail has to show exactly what changed and who changed it.
    before: Object.fromEntries(Object.keys(data).map((k) => [k, (target as Record<string, unknown>)[k] ?? null])),
    after: data,
  });

  return NextResponse.json({ ok: true, ...data });
}

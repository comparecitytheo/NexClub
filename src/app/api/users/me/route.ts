import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireUserForWrite } from "@/server/api-helpers";
import { isAdminOrAbove } from "@/lib/rbac";
import { recordAudit } from "@/server/audit";
import { updateProfileSchema } from "@/server/validators/profile";

export async function GET() {
  const a = await requireUser();
  if ("error" in a) return a.error;

  const me = await prisma.user.findUnique({
    where: { id: a.user.id },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      businessName: true, industry: true, services: true, phone: true, avatarUrl: true, bio: true,
      themePreferences: true,
      organizationId: true, createdAt: true,
    },
  });

  return NextResponse.json(me);
}

export async function PATCH(req: Request) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  const body = await req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const profile = parsed.data;

  // A single update now that contacts are gone — no transaction needed.
  // Address fields belong to the BUSINESS, not the user, so they are split out
  // and written separately. A member knows their own address better than a
  // Super Admin does, but it IS shared — colleagues at the same business see
  // and can change the same value.
  const ADDRESS_KEYS = ["addressLine1", "addressLine2", "suburb", "state", "postcode"] as const;
  const address = Object.fromEntries(
    ADDRESS_KEYS.filter((k) => k in profile).map((k) => [k, profile[k] || null])
  );
  const userFields = { ...profile };
  for (const k of ADDRESS_KEYS) delete (userFields as Record<string, unknown>)[k];

  await prisma.user.update({ where: { id: user.id }, data: userFields });

  // Admins and above only. The business address is shared by everyone at that
  // business, so a staff member changing it would change it for their director
  // too. Enforced here, not just hidden in the UI — the form is a courtesy, the
  // server check is the boundary.
  if (Object.keys(address).length > 0 && !isAdminOrAbove(user.role)) {
    return NextResponse.json(
      { error: "Only an admin can change the business address." },
      { status: 403 }
    );
  }

  // Only if they actually belong to a business — a member with none has no
  // address to set, and writing would silently do nothing.
  if (Object.keys(address).length > 0) {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });
    if (me?.businessId) {
      await prisma.business.update({ where: { id: me.businessId }, data: address });
    }
  }

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    after: profile,
  });

  return NextResponse.json({ ok: true });
}

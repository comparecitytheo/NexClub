import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
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
      organizationId: true, createdAt: true,
    },
  });

  return NextResponse.json(me);
}

export async function PATCH(req: Request) {
  const a = await requireUser();
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

  const { businessContacts, ...profile } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: profile });

    // Business contacts are managed as a set: replace them on save.
    if (businessContacts) {
      await tx.businessContact.deleteMany({ where: { userId: user.id } });
      if (businessContacts.length > 0) {
        await tx.businessContact.createMany({
          data: businessContacts.map((c) => ({
            userId: user.id,
            name: c.name,
            role: c.role ?? null,
            phone: c.phone ?? null,
            email: c.email ?? null,
          })),
        });
      }
    }
  });

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

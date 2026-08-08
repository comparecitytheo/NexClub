import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminForWrite } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";

export const runtime = "nodejs";

const renameSchema = z.object({
  name: z.string().trim().min(2, "Give the business a name").max(160),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Rename a business.
 *
 * `User.businessName` is a DISPLAY MIRROR of this name, read by many screens.
 * Renaming without updating it would leave every member showing the old name
 * while the directory showed the new one — so both are written in a single
 * transaction. Either the rename lands everywhere, or nowhere.
 */
export async function PATCH(req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const parsed = renameSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const name = parsed.data.name;

  const existing = await prisma.business.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, name: true },
  });
  if (!existing) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  // Refuse a name another business already uses, case-insensitively — otherwise
  // the directory would show two cards that look identical.
  const clash = await prisma.business.findFirst({
    where: {
      organizationId: user.organizationId,
      name: { equals: name, mode: "insensitive" },
      id: { not: id },
    },
    select: { id: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: `Another business is already called ${name}.` },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.business.update({ where: { id }, data: { name } }),
    // The mirror, kept in step. Without this the rename would be half-applied.
    prisma.user.updateMany({ where: { businessId: id }, data: { businessName: name } }),
  ]);

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "Business",
    entityId: id,
    before: { name: existing.name },
    after: { name },
  });

  return NextResponse.json({ ok: true, name });
}

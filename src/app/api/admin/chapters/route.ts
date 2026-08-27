import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireSuperAdminForWrite } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";
import { getClientContext } from "@/server/request";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(2, "Give the chapter a name").max(60),
});

/**
 * Chapters — the club's geographic groups (The Shire, Parramatta, CBD…).
 *
 * Organisational only. A chapter never affects who can see a lead or what a
 * member may do; that stays scoped by business. Kept deliberately separate so a
 * future change to chapters cannot quietly widen access.
 */
export async function GET() {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;

  const items = await prisma.chapter.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      // Member count, so the admin page can warn before deleting a chapter
      // that people are still assigned to.
      _count: { select: { businesses: true } },
    },
  });

  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id,
      name: c.name,
      businessCount: c._count.businesses,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const name = parsed.data.name;

  // Case-insensitive duplicate check, so "the shire" cannot be added alongside
  // "The Shire". The unique index is exact-match only and would let that pass.
  const clash = await prisma.chapter.findFirst({
    where: {
      organizationId: user.organizationId,
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: `"${clash.name}" already exists.` },
      { status: 409 }
    );
  }

  const chapter = await prisma.chapter.create({
    data: { organizationId: user.organizationId, name },
    select: { id: true, name: true, createdAt: true },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "CREATE",
    entityType: "CHAPTER",
    entityId: chapter.id,
    after: { name: chapter.name },
    ...getClientContext(req),
  });

  return NextResponse.json({
    chapter: { ...chapter, businessCount: 0, createdAt: chapter.createdAt.toISOString() },
  });
}

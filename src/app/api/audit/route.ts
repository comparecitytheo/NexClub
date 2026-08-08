import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/api-helpers";

const listAuditSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.string().optional(),
  actorId: z.string().optional(),
  q: z.string().optional(),
});

export async function GET(req: Request) {
  const a = await requireAdmin();
  if ("error" in a) return a.error;
  const { user } = a;

  const { searchParams } = new URL(req.url);
  const parsed = listAuditSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  const { page, pageSize, action, entityType, actorId, q } = parsed.data;

  const where: Prisma.AuditLogWhereInput = {
    organizationId: user.organizationId,
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(actorId ? { actorId } : {}),
    ...(q
      ? {
          OR: [
            { entityType: { contains: q, mode: "insensitive" } },
            { entityId: { contains: q } },
            { actor: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, items] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    }),
  ]);

  // Map to the flat shape AuditTable/AuditRow expects, so paginated pages render
  // the actor name the same way the server-rendered first page does (the raw
  // records nest it under `actor`).
  const rows = items.map((a) => ({
    id: a.id,
    createdAt: a.createdAt.toISOString(),
    actorName: a.actor?.name ?? null,
    actorId: a.actor?.id ?? null,
    actorAvatarUrl: a.actor?.avatarUrl ?? null,
    ipAddress: a.ipAddress,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    before: a.before,
    after: a.after,
  }));

  return NextResponse.json({ items: rows, total, page, totalPages: Math.ceil(total / pageSize) });
}

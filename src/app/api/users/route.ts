import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/api-helpers";
import { listUsersSchema } from "@/server/validators/user";

export async function GET(req: Request) {
  const a = await requireAdmin();
  if ("error" in a) return a.error;
  const { user } = a;

  const { searchParams } = new URL(req.url);
  const parsed = listUsersSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const { page, pageSize, q, role } = parsed.data;
  const where: Prisma.UserWhereInput = {
    organizationId: user.organizationId,
    ...(role ? { role } : {}),
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : {}),
  };

  const [total, items] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, email: true, role: true, isActive: true,
        businessName: true, industry: true, phone: true, avatarUrl: true, createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

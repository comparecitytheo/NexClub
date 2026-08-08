import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, requireUserForWrite } from "@/server/api-helpers";
import { ownerScope } from "@/server/scope";
import { createCompanySchema, listCompaniesSchema } from "@/server/validators/company";
import { recordAudit } from "@/server/audit";

export async function GET(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const { searchParams } = new URL(req.url);
  const parsed = listCompaniesSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  const { page, pageSize, q } = parsed.data;

  const where: Prisma.CompanyWhereInput = {
    ...ownerScope(user),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const [total, items] = await prisma.$transaction([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { contacts: true, deals: true } } },
    }),
  ]);

  return NextResponse.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(req: Request) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  const parsed = createCompanySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const company = await prisma.company.create({
    data: { ...parsed.data, organizationId: user.organizationId, ownerId: user.id },
  });

  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "CREATE", entityType: "Company", entityId: company.id });
  return NextResponse.json(company, { status: 201 });
}

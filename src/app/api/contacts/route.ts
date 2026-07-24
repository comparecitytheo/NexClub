import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { ownerScope } from "@/server/scope";
import { createContactSchema, listContactsSchema } from "@/server/validators/contact";
import { recordAudit } from "@/server/audit";

export async function GET(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const { searchParams } = new URL(req.url);
  const parsed = listContactsSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  const { page, pageSize, q, status, companyId } = parsed.data;

  const where: Prisma.ContactWhereInput = {
    ...ownerScope(user),
    ...(status ? { status } : {}),
    ...(companyId ? { companyId } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await prisma.$transaction([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { company: { select: { id: true, name: true } } },
    }),
  ]);

  return NextResponse.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const parsed = createContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { companyId, tags, ...rest } = parsed.data;

  if (companyId) {
    const company = await prisma.company.findFirst({ where: { id: companyId, organizationId: user.organizationId } });
    if (!company) return NextResponse.json({ error: "Linked company not found" }, { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: {
      ...rest,
      tags: tags ?? [],
      companyId: companyId ?? null,
      organizationId: user.organizationId,
      ownerId: user.id,
    },
  });

  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "CREATE", entityType: "Contact", entityId: contact.id });
  return NextResponse.json(contact, { status: 201 });
}

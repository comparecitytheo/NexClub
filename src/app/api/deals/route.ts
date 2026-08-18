import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, requireUserForWrite } from "@/server/api-helpers";
import { ownerScope } from "@/server/scope";
import { createDealSchema, listDealsSchema } from "@/server/validators/deal";
import { recordAudit } from "@/server/audit";

const DEAL_INCLUDE = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  owner: { select: { id: true, name: true } },
} satisfies Prisma.DealInclude;

export async function GET(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const { searchParams } = new URL(req.url);
  const parsed = listDealsSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  const { q } = parsed.data;

  const where: Prisma.DealWhereInput = {
    ...ownerScope(user),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };

  const items = await prisma.deal.findMany({
    where,
    orderBy: [{ boardPosition: "asc" }, { updatedAt: "desc" }],
    include: DEAL_INCLUDE,
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  const parsed = createDealSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { companyId, contactId, value, ...rest } = parsed.data;

  if (companyId) {
    const company = await prisma.company.findFirst({ where: { id: companyId, organizationId: user.organizationId } });
    if (!company) return NextResponse.json({ error: "Linked company not found" }, { status: 400 });
  }
  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, organizationId: user.organizationId } });
    if (!contact) return NextResponse.json({ error: "Linked contact not found" }, { status: 400 });
  }

  const deal = await prisma.deal.create({
    data: {
      ...rest,
      organizationId: user.organizationId,
      ownerId: user.id,
      companyId: companyId || null,
      contactId: contactId || null,
      value: value ?? 0,
      boardPosition: 0,
    },
    include: DEAL_INCLUDE,
  });

  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "CREATE", entityType: "Deal", entityId: deal.id });
  return NextResponse.json(deal, { status: 201 });
}

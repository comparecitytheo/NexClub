import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { ownerScope } from "@/server/scope";
import { updateDealSchema } from "@/server/validators/deal";
import { closedFields } from "@/server/deal-helpers";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };


export async function GET(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { id } = await params;

  const deal = await prisma.deal.findFirst({
    where: { id, ...ownerScope(a.user) },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      owner: { select: { id: true, name: true } },
      activityEntries: { orderBy: { occurredAt: "desc" }, take: 20, include: { user: { select: { name: true } } } },
      taskEntries: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: { dueDate: "asc" },
        take: 10,
        include: { assignee: { select: { name: true } } },
      },
    },
  });
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function PATCH(req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const existing = await prisma.deal.findFirst({ where: { id, ...ownerScope(user) } });
  if (!existing) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const parsed = updateDealSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { companyId, contactId, value, expectedCloseDate, stage, ...rest } = parsed.data;

  if (companyId) {
    const company = await prisma.company.findFirst({ where: { id: companyId, organizationId: user.organizationId } });
    if (!company) return NextResponse.json({ error: "Linked company not found" }, { status: 400 });
  }
  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, organizationId: user.organizationId } });
    if (!contact) return NextResponse.json({ error: "Linked contact not found" }, { status: 400 });
  }

  const data: Prisma.DealUpdateInput = { ...rest };
  if (value !== undefined) data.value = value ?? 0;
  if (companyId !== undefined) data.company = companyId ? { connect: { id: companyId } } : { disconnect: true };
  if (contactId !== undefined) data.contact = contactId ? { connect: { id: contactId } } : { disconnect: true };
  if (expectedCloseDate !== undefined) data.expectedCloseDate = expectedCloseDate ?? null;
  const stageChanged = stage !== undefined && stage !== existing.stage;
  if (stage !== undefined) {
    data.stage = stage;
    Object.assign(data, closedFields(stage));
  }

  const deal = await prisma.deal.update({ where: { id }, data });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: stageChanged ? "STATUS_CHANGE" : "UPDATE",
    entityType: "Deal",
    entityId: id,
    ...(stageChanged ? { before: { stage: existing.stage }, after: { stage } } : {}),
  });
  return NextResponse.json(deal);
}

export async function DELETE(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const existing = await prisma.deal.findFirst({ where: { id, ...ownerScope(user) } });
  if (!existing) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  await prisma.deal.softDelete({ id });
  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "DELETE", entityType: "Deal", entityId: id });
  return NextResponse.json({ ok: true });
}

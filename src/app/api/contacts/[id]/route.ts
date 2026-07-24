import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { ownerScope } from "@/server/scope";
import { updateContactSchema } from "@/server/validators/contact";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { id } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id, ...ownerScope(a.user) },
    include: { company: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } } },
  });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PATCH(req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const existing = await prisma.contact.findFirst({ where: { id, ...ownerScope(user) } });
  if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const parsed = updateContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { companyId, ...rest } = parsed.data;

  if (companyId) {
    const company = await prisma.company.findFirst({ where: { id: companyId, organizationId: user.organizationId } });
    if (!company) return NextResponse.json({ error: "Linked company not found" }, { status: 400 });
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: { ...rest, ...(companyId !== undefined ? { companyId: companyId || null } : {}) },
  });

  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "Contact", entityId: id });
  return NextResponse.json(contact);
}

export async function DELETE(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const existing = await prisma.contact.findFirst({ where: { id, ...ownerScope(user) } });
  if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  await prisma.contact.softDelete({ id });
  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "DELETE", entityType: "Contact", entityId: id });
  return NextResponse.json({ ok: true });
}

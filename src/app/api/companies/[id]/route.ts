import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { ownerScope } from "@/server/scope";
import { updateCompanySchema } from "@/server/validators/company";
import { recordAudit } from "@/server/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { id } = await params;

  const company = await prisma.company.findFirst({
    where: { id, ...ownerScope(a.user) },
    include: {
      owner: { select: { id: true, name: true } },
      contacts: { select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const existing = await prisma.company.findFirst({ where: { id, ...ownerScope(user) } });
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const parsed = updateCompanySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const company = await prisma.company.update({ where: { id }, data: parsed.data });
  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "UPDATE", entityType: "Company", entityId: id });
  return NextResponse.json(company);
}

export async function DELETE(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const existing = await prisma.company.findFirst({ where: { id, ...ownerScope(user) } });
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  await prisma.company.softDelete({ id });
  await recordAudit({ organizationId: user.organizationId, actorId: user.id, action: "DELETE", entityType: "Company", entityId: id });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireSuperAdminForWrite } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";
import { listIndustriesWithUsage, resolveOrCreateIndustry } from "@/server/industries";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(2, "Give the industry a name").max(60),
});

export async function GET() {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  return NextResponse.json({ items: await listIndustriesWithUsage() });
}

// Add an industry so it appears in every dropdown and directory filter.
// resolveOrCreateIndustry is case-insensitive, so this can never create a
// near-duplicate like "finance" alongside "Finance".
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

  const name = await resolveOrCreateIndustry(parsed.data.name);

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "CREATE",
    entityType: "Industry",
    after: { name },
  });

  return NextResponse.json({ ok: true, name });
}

// Remove an industry from the list. Members already on it keep their industry —
// the string lives on the member record — so this only stops it being offered.
export async function DELETE(req: Request) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.industry.findUnique({ where: { id }, select: { name: true } });
  if (!existing) return NextResponse.json({ error: "Industry not found" }, { status: 404 });

  await prisma.industry.delete({ where: { id } });
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "DELETE",
    entityType: "Industry",
    before: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
}

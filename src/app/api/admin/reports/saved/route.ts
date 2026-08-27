import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireSuperAdminForWrite } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";

/**
 * Saved custom reports.
 *
 * A saved report is a NAME plus a list of metric keys and the scope to run
 * them in — not a stored result. Running it again re-queries, so an old saved
 * report always shows current numbers rather than a stale snapshot.
 */
const createSchema = z.object({
  name: z.string().trim().min(2, "Give the report a name").max(80),
  metricKeys: z.array(z.string().trim().min(1)).min(1, "Add at least one metric").max(12),
  businessKey: z.string().trim().optional(),
  rangeDays: z.number().int().positive().max(3650).optional(),
});

export async function GET() {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;
  const items = await prisma.savedReport.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      metricKeys: true,
      businessKey: true,
      rangeDays: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({
    items: items.map((i) => ({ ...i, updatedAt: i.updatedAt.toISOString() })),
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
  const { name, metricKeys, businessKey, rangeDays } = parsed.data;

  // Case-insensitive, so "Monthly" and "monthly" cannot both exist and confuse
  // the list — same rule industries and chapters use.
  const clash = await prisma.savedReport.findFirst({
    where: { organizationId: user.organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) {
    return NextResponse.json({ error: `A report called ${name} already exists.` }, { status: 409 });
  }

  const saved = await prisma.savedReport.create({
    data: {
      organizationId: user.organizationId,
      name,
      // De-duplicated but order preserved: the builder lists them in this order.
      metricKeys: [...new Set(metricKeys)],
      businessKey: businessKey || null,
      rangeDays: rangeDays ?? null,
      createdById: user.id,
    },
    select: { id: true, name: true, metricKeys: true, businessKey: true, rangeDays: true, updatedAt: true },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "CREATE",
    entityType: "SAVED_REPORT",
    entityId: saved.id,
    after: { name: saved.name, metricKeys: saved.metricKeys, businessKey: saved.businessKey },
  });

  return NextResponse.json({ report: { ...saved, updatedAt: saved.updatedAt.toISOString() } });
}

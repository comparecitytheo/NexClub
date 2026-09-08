import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, requireSuperAdminForWrite } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(2, "Give the business a name").max(160),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
});

// Every business in the club, with how many members each has. Super Admin only:
// renaming a business changes how it appears to everyone, so it is not a
// per-member setting.
export async function GET() {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;
  const { user } = a;

  const businesses = await prisma.business.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      industry: true,
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({
    items: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      industry: b.industry,
      memberCount: b._count.members,
    })),
  });
}

/**
 * Create a business with nobody in it.
 *
 * Until now a business could only come into being as a side effect of adding or
 * inviting a member who named it (resolveBusiness), which is why the manager
 * screen had no "New business" button. The club asked to be able to set one up
 * in advance — typically to assign it to a chapter before its first member
 * arrives — so an empty business is now a legitimate state.
 *
 * Names are matched case-insensitively against the existing set, because
 * resolveBusiness matches that way too: allowing "Acme" alongside "ACME" would
 * mean the next member typing either name joins an arbitrary one of the two.
 */
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
  const { name } = parsed.data;
  const industry = parsed.data.industry?.trim() || null;

  const clash = await prisma.business.findFirst({
    where: { organizationId: user.organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: `${clash.name} already exists.` },
      { status: 409 }
    );
  }

  const business = await prisma.business.create({
    data: { organizationId: user.organizationId, name, industry },
    select: { id: true, name: true, industry: true },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "CREATE",
    entityType: "Business",
    entityId: business.id,
    after: { name: business.name, industry: business.industry },
  });

  return NextResponse.json({ ...business, memberCount: 0 }, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/server/api-helpers";

export const runtime = "nodejs";

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

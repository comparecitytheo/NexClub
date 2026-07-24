import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";

// Any member can read the club roster (needed to send/assign leads).
export async function GET() {
  const a = await requireUser();
  if ("error" in a) return a.error;

  const items = await prisma.user.findMany({
    where: { organizationId: a.user.organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, businessName: true },
  });

  return NextResponse.json({ items });
}

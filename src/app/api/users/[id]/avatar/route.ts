import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { isStorageConfigured, publicImageUrl } from "@/lib/storage";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Returns the member's avatar by redirecting to its stored public URL.
// Only reachable by signed-in members of the same organization.
export async function GET(_req: Request, { params }: Params) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { id } = await params;

  if (!isStorageConfigured()) return new NextResponse(null, { status: 404 });

  const target = await prisma.user.findFirst({
    where: { id, organizationId: a.user.organizationId },
    select: { avatarUrl: true },
  });
  if (!target?.avatarUrl) return new NextResponse(null, { status: 404 });

  const url = await publicImageUrl(target.avatarUrl);
  return NextResponse.redirect(url, {
    status: 307,
    headers: { "Cache-Control": "private, max-age=300" },
  });
}

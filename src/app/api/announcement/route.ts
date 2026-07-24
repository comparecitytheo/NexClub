import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireSuperAdmin } from "@/server/api-helpers";

// Empty string clears the banner; capped so it can't overflow the header.
const schema = z.object({
  announcement: z.string().max(280),
});

// Anyone signed in can READ their organization's announcement (it's shown in
// the header to everyone). Scoped to the caller's own org.
export async function GET() {
  const a = await requireUser();
  if ("error" in a) return a.error;

  const org = await prisma.organization.findUnique({
    where: { id: a.user.organizationId },
    select: { announcement: true },
  });
  return NextResponse.json({ announcement: org?.announcement ?? "" });
}

// Only SUPER_ADMIN can WRITE. This is the authoritative authorization check —
// the client merely hides the edit button; the server must enforce the role.
// `requireSuperAdmin` returns 401 if unauthenticated, 403 if the role is below
// SUPER_ADMIN. The update is scoped to the caller's own organization.
export async function PUT(req: Request) {
  const a = await requireSuperAdmin();
  if ("error" in a) return a.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 422 });
  }

  const value = parsed.data.announcement.trim();
  const org = await prisma.organization.update({
    where: { id: a.user.organizationId },
    data: { announcement: value || null }, // store null when cleared
    select: { announcement: true },
  });

  return NextResponse.json({ announcement: org.announcement ?? "" });
}

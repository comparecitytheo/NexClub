import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminForWrite } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";
import { getClientContext } from "@/server/request";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const renameSchema = z.object({
  name: z.string().trim().min(2, "Give the chapter a name").max(60),
});

/**
 * Rename a chapter. Members are linked by id, so every member's chapter updates
 * automatically — nothing needs rewriting across the directory.
 */
export async function PATCH(req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const parsed = renameSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const name = parsed.data.name;

  const chapter = await prisma.chapter.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, name: true },
  });
  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
  }

  // Case-insensitive, and excluding itself so re-saving the same name is fine.
  const clash = await prisma.chapter.findFirst({
    where: {
      organizationId: user.organizationId,
      name: { equals: name, mode: "insensitive" },
      NOT: { id },
    },
    select: { name: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: `"${clash.name}" already exists.` },
      { status: 409 }
    );
  }

  await prisma.chapter.update({ where: { id }, data: { name } });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "CHAPTER",
    entityId: id,
    before: { name: chapter.name },
    after: { name },
    ...(await getClientContext()),
  });

  return NextResponse.json({ ok: true, name });
}

/**
 * Delete a chapter.
 *
 * Refused while members are still assigned. The relation is SetNull, so
 * deleting would silently strip the chapter from every business in it —
 * recoverable but invisible, and nobody would know which to put back. Reassigning first is
 * the deliberate step.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const chapter = await prisma.chapter.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true,
      name: true,
      _count: { select: { businesses: true } },
    },
  });
  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
  }

  if (chapter._count.businesses > 0) {
    const n = chapter._count.businesses;
    return NextResponse.json(
      {
        error: `${n} business${n === 1 ? " is" : "es are"} still in ${chapter.name}. Move them to another chapter first.`,
      },
      { status: 409 }
    );
  }

  await prisma.chapter.delete({ where: { id } });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "DELETE",
    entityType: "CHAPTER",
    entityId: id,
    before: { name: chapter.name },
    ...(await getClientContext()),
  });

  return NextResponse.json({ ok: true });
}

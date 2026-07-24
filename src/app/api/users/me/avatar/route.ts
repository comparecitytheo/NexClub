import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";
import {
  isStorageConfigured,
  putAvatar,
  deleteAvatar,
  ALLOWED_IMAGE_TYPES,
  MAX_AVATAR_BYTES,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Image storage isn't configured yet." },
      { status: 503 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image was uploaded." }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, WebP or GIF image." }, { status: 400 });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Image must be 5MB or smaller." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await putAvatar(user.id, buffer);

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    after: { avatarUrl: url },
  });

  return NextResponse.json({ ok: true, avatarUrl: url });
}

export async function DELETE() {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  await deleteAvatar(user.id);

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    after: { avatarUrl: null },
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserForWrite } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";
import {
  isStorageConfigured,
  putBusinessLogo,
  deleteBusinessLogo,
  ALLOWED_IMAGE_TYPES,
  MAX_AVATAR_BYTES,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const a = await requireUserForWrite();
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
  const key = await putBusinessLogo(user.id, buffer, file.type);

  // Claim the logo for the whole business, so every screen shows this one rather
  // than whichever colleague happened to upload first.
  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { businessId: true },
  });
  if (me?.businessId) {
    await prisma.business.update({
      where: { id: me.businessId },
      data: { logoUserId: user.id },
    });
  }

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { businessLogoUrl: true },
  });
  await prisma.user.update({ where: { id: user.id }, data: { businessLogoUrl: key } });
  if (existing?.businessLogoUrl && existing.businessLogoUrl !== key) {
    await deleteBusinessLogo(user.id);
  }

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    after: { businessLogoUrl: key },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { businessLogoUrl: true },
  });
  await prisma.user.update({ where: { id: user.id }, data: { businessLogoUrl: null } });

  // Release the business's claim, and fall back to another member who still has
  // a logo — otherwise removing yours would leave the business with none while a
  // colleague's sat unused.
  const mine = await prisma.user.findUnique({
    where: { id: user.id },
    select: { businessId: true },
  });
  if (mine?.businessId) {
    const successor = await prisma.user.findFirst({
      where: { businessId: mine.businessId, businessLogoUrl: { not: null }, id: { not: user.id } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    await prisma.business.updateMany({
      where: { id: mine.businessId, logoUserId: user.id },
      data: { logoUserId: successor?.id ?? null },
    });
  }
  if (existing?.businessLogoUrl) await deleteBusinessLogo(user.id);

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    after: { businessLogoUrl: null },
  });

  return NextResponse.json({ ok: true });
}

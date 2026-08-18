import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminForWrite } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";

export const runtime = "nodejs";

const renameSchema = z.object({
  name: z.string().trim().min(2, "Give the business a name").max(160),
  // Chapter is a LOCATION, so it belongs to the business rather than to each
  // member. Empty string clears it.
  chapterId: z.string().trim().optional().or(z.literal("")),
  // Address parts. All optional — plenty of members are sole traders with no
  // premises to list — and an empty string clears the field.
  addressLine1: z.string().trim().max(160).optional().or(z.literal("")),
  addressLine2: z.string().trim().max(160).optional().or(z.literal("")),
  suburb: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(40).optional().or(z.literal("")),
  postcode: z.string().trim().max(12).optional().or(z.literal("")),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Rename a business.
 *
 * `User.businessName` is a DISPLAY MIRROR of this name, read by many screens.
 * Renaming without updating it would leave every member showing the old name
 * while the directory showed the new one — so both are written in a single
 * transaction. Either the rename lands everywhere, or nowhere.
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

  const existing = await prisma.business.findFirst({
    where: { id, organizationId: user.organizationId },
    // Address fields are selected so the audit can record a real before/after
    // diff rather than an empty object.
    select: {
      id: true, name: true,
      addressLine1: true, addressLine2: true, suburb: true, state: true, postcode: true,
    },
  });
  if (!existing) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  // Refuse a name another business already uses, case-insensitively — otherwise
  // the directory would show two cards that look identical.
  const clash = await prisma.business.findFirst({
    where: {
      organizationId: user.organizationId,
      name: { equals: name, mode: "insensitive" },
      id: { not: id },
    },
    select: { id: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: `Another business is already called ${name}.` },
      { status: 409 }
    );
  }

  // The id comes from the client, so confirm the chapter is real and belongs to
  // this organisation before writing it.
  const chapterId = parsed.data.chapterId;
  if (chapterId) {
    const ok = await prisma.chapter.findFirst({
      where: { id: chapterId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json({ error: "Unknown chapter." }, { status: 400 });
    }
  }

  const ADDRESS_KEYS = ["addressLine1", "addressLine2", "suburb", "state", "postcode"] as const;
  const addressBefore = Object.fromEntries(
    ADDRESS_KEYS.filter((k) => parsed.data[k] !== undefined).map((k) => [k, (existing as Record<string, unknown>)[k] ?? null])
  );
  const addressAfter = Object.fromEntries(
    ADDRESS_KEYS.filter((k) => parsed.data[k] !== undefined).map((k) => [k, parsed.data[k] === "" ? null : parsed.data[k]])
  );

  await prisma.$transaction([
    prisma.business.update({
      where: { id },
      data: {
        name,
        ...(chapterId === undefined ? {} : { chapterId: chapterId === "" ? null : chapterId }),
        // Only fields actually sent are written, so editing the name alone
        // cannot wipe an address. Empty string means "clear this".
        ...Object.fromEntries(
          (["addressLine1", "addressLine2", "suburb", "state", "postcode"] as const)
            .filter((k) => parsed.data[k] !== undefined)
            .map((k) => [k, parsed.data[k] === "" ? null : parsed.data[k]])
        ),
      },
    }),
    // The mirror, kept in step. Without this the rename would be half-applied.
    prisma.user.updateMany({ where: { businessId: id }, data: { businessName: name } }),
  ]);

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "Business",
    entityId: id,
    before: { name: existing.name, ...addressBefore },
    after: { name, ...addressAfter },
  });

  return NextResponse.json({ ok: true, name });
}

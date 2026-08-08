import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminForWrite } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";
import { notifyWholeClub } from "@/server/events/announce";
import { eventSchema } from "@/server/validators/event";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Editing is Super Admin only.
export async function PATCH(req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const existing = await prisma.event.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, title: true, startsAt: true, endsAt: true },
  });
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const parsed = eventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const startsAt = new Date(d.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Start date is not valid." }, { status: 400 });
  }
  const endsAt = d.endsAt ? new Date(d.endsAt) : null;
  if (endsAt && endsAt < startsAt) {
    return NextResponse.json({ error: "The event cannot end before it starts." }, { status: 400 });
  }

  await prisma.event.update({
    where: { id },
    data: {
      title: d.title,
      description: d.description || null,
      location: d.location || null,
      startsAt,
      endsAt,
    },
  });

  // Only a change of DATE OR TIME is worth telling the club about. Fixing a
  // typo in the description or the title should not email everyone again.
  const rescheduled =
    existing.startsAt.getTime() !== startsAt.getTime() ||
    (existing.endsAt?.getTime() ?? null) !== (endsAt?.getTime() ?? null);

  if (rescheduled) {
    await notifyWholeClub({
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name,
      type: "EVENT_RESCHEDULED",
      eventId: id,
      title: `Rescheduled: ${d.title}`,
      body: startsAt.toISOString(),
      excerpt: `Now ${startsAt.toLocaleString("en-AU", { dateStyle: "full", timeStyle: "short" })}.`,
      eventTitle: d.title,
    });
  }

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "UPDATE",
    entityType: "Event",
    entityId: id,
    before: { title: existing.title, startsAt: existing.startsAt.toISOString() },
    after: { title: d.title, startsAt: startsAt.toISOString(), rescheduled },
  });

  return NextResponse.json({ ok: true, rescheduled });
}

// Deleting is Super Admin only. Soft delete, so the club calendar loses it but
// the record and its RSVPs survive.
export async function DELETE(_req: Request, { params }: Params) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const existing = await prisma.event.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, title: true },
  });
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  await prisma.event.softDelete({ id });

  // Cancelling is always worth telling the club — people may have it in their
  // diary and blocked out the time.
  await notifyWholeClub({
    organizationId: user.organizationId,
    actorId: user.id,
    actorName: user.name,
    type: "EVENT_CANCELLED",
    eventId: id,
    title: `Cancelled: ${existing.title}`,
    body: null,
    eventTitle: existing.title,
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "DELETE",
    entityType: "Event",
    entityId: id,
    before: { title: existing.title },
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminForWrite, requireUser } from "@/server/api-helpers";
import { recordAudit } from "@/server/audit";
import { notifyWholeClub } from "@/server/events/announce";
import { eventSchema } from "@/server/validators/event";

export const runtime = "nodejs";

// Every member can read the club calendar.
export async function GET() {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  const events = await prisma.event.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { startsAt: "asc" },
    include: {
      createdBy: { select: { name: true } },
      rsvps: { select: { userId: true, status: true } },
    },
  });

  return NextResponse.json({ items: events.map((e) => shape(e, user.id)) });
}

// Creating is Super Admin only, enforced here — hiding the button is not the
// boundary. Everyone in the club is then notified.
export async function POST(req: Request) {
  const a = await requireSuperAdminForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

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

  const event = await prisma.event.create({
    data: {
      organizationId: user.organizationId,
      title: d.title,
      description: d.description || null,
      location: d.location || null,
      startsAt,
      endsAt,
      createdById: user.id,
    },
  });

  // The whole club hears about it, through the same helper the reschedule and
  // cancellation announcements use — one recipient list, built once.
  await notifyWholeClub({
    organizationId: user.organizationId,
    actorId: user.id,
    actorName: user.name,
    type: "EVENT_CREATED",
    eventId: event.id,
    title: `New club event: ${event.title}`,
    body: event.location,
    excerpt: event.description ?? undefined,
    eventTitle: event.title,
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: "CREATE",
    entityType: "Event",
    entityId: event.id,
    after: { title: event.title },
  });

  return NextResponse.json({ ok: true, id: event.id }, { status: 201 });
}

type EventRow = {
  id: string; title: string; description: string | null; location: string | null;
  startsAt: Date; endsAt: Date | null;
  createdBy: { name: string };
  rsvps: { userId: string; status: string }[];
};

function shape(e: EventRow, viewerId: string) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    createdByName: e.createdBy.name,
    goingCount: e.rsvps.filter((r) => r.status === "GOING").length,
    myRsvp: e.rsvps.find((r) => r.userId === viewerId)?.status ?? null,
  };
}

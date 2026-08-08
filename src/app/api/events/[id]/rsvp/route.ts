import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserForWrite } from "@/server/api-helpers";
import { rsvpSchema } from "@/server/validators/event";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// Any member of the club can RSVP — this is the one part of events that is not
// Super Admin gated. One row per member per event, so changing your mind updates
// rather than stacking up duplicates.
export async function POST(req: Request, { params }: Params) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  const parsed = rsvpSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose going or not going." }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  await prisma.eventRsvp.upsert({
    where: { eventId_userId: { eventId: id, userId: user.id } },
    create: { eventId: id, userId: user.id, status: parsed.data.status },
    update: { status: parsed.data.status },
  });

  const goingCount = await prisma.eventRsvp.count({
    where: { eventId: id, status: "GOING" },
  });

  return NextResponse.json({ ok: true, status: parsed.data.status, goingCount });
}

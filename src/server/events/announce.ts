import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notify";
import type { NotificationType } from "@prisma/client";

/**
 * Announce something about an event to the whole club.
 *
 * One helper for all three announcements — new, rescheduled, cancelled — so the
 * recipient list is built the same way every time. notify() drops the actor and
 * de-dupes, so the Super Admin who made the change is never told about their own
 * change, and it honours each member's email preference and unsubscribe link.
 *
 * These are the ONLY moments the whole club hears about an event. Editing a
 * title, a location or a description notifies nobody.
 */
export async function notifyWholeClub(input: {
  organizationId: string;
  actorId: string;
  actorName?: string | null;
  type: Extract<NotificationType, "EVENT_CREATED" | "EVENT_RESCHEDULED" | "EVENT_CANCELLED">;
  eventId: string;
  title: string;
  body: string | null;
  excerpt?: string;
  eventTitle: string;
}): Promise<void> {
  const members = await prisma.user.findMany({
    where: { organizationId: input.organizationId, isActive: true },
    select: { id: true },
  });

  await notify({
    organizationId: input.organizationId,
    recipientIds: members.map((m) => m.id),
    actorId: input.actorId,
    type: input.type,
    title: input.title,
    body: input.body,
    entityType: "EVENT",
    // A cancelled event still deep-links: the notification list resolves it and
    // the member sees it is gone rather than landing on a dead route.
    entityId: input.eventId,
    email: {
      actorName: input.actorName ?? undefined,
      taskTitle: input.eventTitle,
      excerpt: input.excerpt,
    },
  });
}

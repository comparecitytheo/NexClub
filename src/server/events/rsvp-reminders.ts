import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notify";

/**
 * WEEKLY RSVP REMINDER (Mondays)
 *
 * Nudges members who have not answered yet about events still to come. Only
 * people with no RSVP row are contacted — answering either way, going or not
 * going, takes you off the list. Nobody is chased about an event they have
 * already responded to, and nobody is chased about an event in the past.
 *
 * Deliberately narrow: this is the only recurring club-wide message. Events
 * otherwise notify on creation, reschedule and cancellation only.
 */

/** Events further out than this are not chased yet — too early to matter. */
export const REMINDER_HORIZON_DAYS = 28;

export type RsvpReminderResult = {
  /** Upcoming events considered. */
  events: number;
  /** Individual reminders sent (one per member per event). */
  reminded: number;
  /** Members skipped because they had already responded. */
  alreadyResponded: number;
  dryRun: boolean;
};

export function isMonday(now: Date = new Date()): boolean {
  return now.getDay() === 1;
}

export async function sendRsvpReminders(
  options: { dryRun?: boolean; now?: Date } = {}
): Promise<RsvpReminderResult> {
  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const horizon = new Date(now.getTime() + REMINDER_HORIZON_DAYS * 86_400_000);

  const events = await prisma.event.findMany({
    where: { startsAt: { gt: now, lte: horizon } },
    select: {
      id: true,
      title: true,
      startsAt: true,
      location: true,
      organizationId: true,
      createdById: true,
      rsvps: { select: { userId: true } },
    },
  });

  let reminded = 0;
  let alreadyResponded = 0;

  for (const event of events) {
    const responded = new Set(event.rsvps.map((r) => r.userId));

    const members = await prisma.user.findMany({
      where: { organizationId: event.organizationId, isActive: true },
      select: { id: true },
    });

    const outstanding = members.filter((m) => !responded.has(m.id)).map((m) => m.id);
    alreadyResponded += members.length - outstanding.length;

    if (outstanding.length === 0) continue;
    reminded += outstanding.length;
    if (dryRun) continue;

    await notify({
      organizationId: event.organizationId,
      recipientIds: outstanding,
      // No actor: this is the system chasing, not a member, so nobody is
      // filtered out as "the person who caused it".
      type: "EVENT_RSVP_REMINDER",
      title: `Are you coming? ${event.title}`,
      body: event.location,
      entityType: "EVENT",
      entityId: event.id,
      email: {
        taskTitle: event.title,
        excerpt: `${event.startsAt.toLocaleString("en-AU", {
          dateStyle: "full",
          timeStyle: "short",
        })}${event.location ? ` at ${event.location}` : ""}.`,
      },
    });
  }

  return { events: events.length, reminded, alreadyResponded, dryRun };
}
